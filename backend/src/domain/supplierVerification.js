import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";
import { getBusinessOwnedBy, getBusinessById } from "./orderAccess.js";

// The full lifecycle a business goes through from "a buyer expressed interest" to "an admin
// decided the outcome". Nothing outside this map is a legal transition, and — like
// orderStateMachine.js — nothing here trusts a request body to say what the "current" state is;
// applyVerificationTransition always reads the business's real state from the database first.
export const TRANSITIONS = {
  SUPPLIER_APPLICATION_STARTED: ["SUPPLIER_VERIFICATION_PENDING"],
  SUPPLIER_VERIFICATION_PENDING: ["SUPPLIER_VERIFIED", "SUPPLIER_REJECTED", "SUPPLIER_RESTRICTED"],
  SUPPLIER_VERIFIED: ["SUPPLIER_RESTRICTED", "SUPPLIER_SUSPENDED"],
  SUPPLIER_RESTRICTED: ["SUPPLIER_VERIFIED", "SUPPLIER_SUSPENDED"],
  SUPPLIER_SUSPENDED: ["SUPPLIER_VERIFIED", "SUPPLIER_RESTRICTED"],
  SUPPLIER_REJECTED: ["SUPPLIER_VERIFICATION_PENDING"], // a rejected applicant can fix their profile/documents and resubmit
};

// Every edge here is either the applicant's own role ("buyer" — the role never changes before
// approval) or one of the two roles that hold role_permissions.verification = 1 in seed.js
// (super_admin, verification_team), so the route-level requirePermission("verification") gate
// and this role gate never disagree.
const ROLE_RULES = {
  "SUPPLIER_APPLICATION_STARTED:SUPPLIER_VERIFICATION_PENDING": ["buyer"],
  "SUPPLIER_REJECTED:SUPPLIER_VERIFICATION_PENDING": ["buyer"],
  "SUPPLIER_VERIFICATION_PENDING:SUPPLIER_VERIFIED": ["super_admin", "verification_team"],
  "SUPPLIER_VERIFICATION_PENDING:SUPPLIER_REJECTED": ["super_admin", "verification_team"],
  "SUPPLIER_VERIFICATION_PENDING:SUPPLIER_RESTRICTED": ["super_admin", "verification_team"],
  "SUPPLIER_VERIFIED:SUPPLIER_RESTRICTED": ["super_admin", "verification_team"],
  "SUPPLIER_VERIFIED:SUPPLIER_SUSPENDED": ["super_admin", "verification_team"],
  "SUPPLIER_RESTRICTED:SUPPLIER_VERIFIED": ["super_admin", "verification_team"],
  "SUPPLIER_RESTRICTED:SUPPLIER_SUSPENDED": ["super_admin", "verification_team"],
  "SUPPLIER_SUSPENDED:SUPPLIER_VERIFIED": ["super_admin", "verification_team"],
  "SUPPLIER_SUSPENDED:SUPPLIER_RESTRICTED": ["super_admin", "verification_team"],
};

// States in which the applicant is still allowed to edit their own profile/documents.
const EDITABLE_STATES = new Set(["SUPPLIER_APPLICATION_STARTED", "SUPPLIER_REJECTED"]);

export class BusinessNotFoundError extends Error {
  constructor() {
    super("Application not found.");
    this.status = 404;
  }
}
export class InvalidVerificationTransitionError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}
export class ForbiddenVerificationTransitionError extends Error {
  constructor(message) {
    super(message);
    this.status = 403;
  }
}
// Thrown when trying to edit a business that has already passed review (verified, restricted,
// or suspended) — there is no "application" left to edit at that point.
export class ApplicationAlreadyExistsError extends Error {
  constructor() {
    super("You already have a supplier business on this account.");
    this.status = 409;
  }
}
// Thrown when trying to edit a business that is currently under review.
export class ApplicationNotEditableError extends Error {
  constructor() {
    super("Your application is under review and can't be edited right now.");
    this.status = 409;
  }
}
export class ApplicationIncompleteError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}
// Only buyers can start a new application — an admin or an already-verified supplier account
// has no legitimate reason to start a fresh one from this endpoint.
export class OnlyBuyersCanApplyError extends Error {
  constructor() {
    super("Only buyer accounts can apply to become a supplier.");
    this.status = 403;
  }
}

const insertBusiness = db.prepare(`
  INSERT INTO businesses (id, owner_user_id, name, type, location, established_year, employees, category, description, contact_email, contact_phone, website, products_summary, verification_status)
  VALUES (@id, @owner_user_id, @name, @type, @location, @established_year, @employees, @category, @description, @contact_email, @contact_phone, @website, @products_summary, 'SUPPLIER_APPLICATION_STARTED')
`);

const updateBusinessDraft = db.prepare(`
  UPDATE businesses
  SET name = @name, type = @type, location = @location, established_year = @established_year,
      employees = @employees, category = @category, description = @description,
      contact_email = @contact_email, contact_phone = @contact_phone, website = @website,
      products_summary = @products_summary, updated_at = datetime('now')
  WHERE id = @id
`);

const updateVerificationStatus = db.prepare(
  "UPDATE businesses SET verification_status = ?, updated_at = datetime('now') WHERE id = ?"
);
const insertVerificationTransition = db.prepare(`
  INSERT INTO business_verification_transitions (id, business_id, from_state, to_state, actor_user_id, reason)
  VALUES (@id, @business_id, @from_state, @to_state, @actor_user_id, @reason)
`);
const listTransitionsForBusiness = db.prepare(
  "SELECT * FROM business_verification_transitions WHERE business_id = ? ORDER BY created_at ASC"
);

const insertDocument = db.prepare(`
  INSERT INTO business_documents (id, business_id, type, file_path, uploaded_by_user_id)
  VALUES (@id, @business_id, @type, @file_path, @uploaded_by_user_id)
`);
const listDocumentsForBusiness = db.prepare("SELECT * FROM business_documents WHERE business_id = ? ORDER BY created_at ASC");
const getDocumentById = db.prepare("SELECT * FROM business_documents WHERE id = ?");
const countDocumentsForBusiness = db.prepare("SELECT COUNT(*) AS n FROM business_documents WHERE business_id = ?");

const insertImage = db.prepare(`
  INSERT INTO business_images (id, business_id, file_path, caption, uploaded_by_user_id)
  VALUES (@id, @business_id, @file_path, @caption, @uploaded_by_user_id)
`);
const listImagesForBusiness = db.prepare("SELECT * FROM business_images WHERE business_id = ? ORDER BY created_at ASC");
const getImageById = db.prepare("SELECT * FROM business_images WHERE id = ?");

const listAllApplications = db.prepare("SELECT * FROM businesses WHERE owner_user_id IS NOT NULL ORDER BY created_at DESC");
const listApplicationsByStatus = db.prepare(
  "SELECT * FROM businesses WHERE owner_user_id IS NOT NULL AND verification_status = ? ORDER BY created_at DESC"
);

const setUserRoleToSupplier = db.prepare("UPDATE users SET role_key = 'supplier' WHERE id = ? AND role_key = 'buyer'");

/**
 * The only function in this codebase allowed to change businesses.verification_status. Every
 * caller goes through here so the transition graph and role rules are enforced in exactly one
 * place — mirrors domain/orderStateMachine.js's applyTransition.
 */
export function applyVerificationTransition(businessId, toState, { actorUserId = null, actorRole, reason = null } = {}) {
  const business = getBusinessById.get(businessId);
  if (!business) throw new BusinessNotFoundError();

  const fromState = business.verification_status;
  const allowedNext = TRANSITIONS[fromState] || [];
  if (!allowedNext.includes(toState)) {
    throw new InvalidVerificationTransitionError(`Cannot move an application from ${fromState} to ${toState}.`);
  }

  const ruleKey = `${fromState}:${toState}`;
  const allowedRoles = ROLE_RULES[ruleKey] || [];
  if (!allowedRoles.includes(actorRole)) {
    throw new ForbiddenVerificationTransitionError(`Your role cannot move an application from ${fromState} to ${toState}.`);
  }

  updateVerificationStatus.run(toState, businessId);
  insertVerificationTransition.run({
    id: genId("BVT"),
    business_id: businessId,
    from_state: fromState,
    to_state: toState,
    actor_user_id: actorUserId,
    reason,
  });
  recordAuditLog({
    actorUserId,
    action: `Business ${businessId} moved from ${fromState} to ${toState}`,
    targetType: "business",
    targetId: businessId,
    reason,
  });

  return getBusinessById.get(businessId);
}

function requireEditableOrThrow(business) {
  if (!business) return; // no application yet: creating one is always allowed
  if (business.verification_status === "SUPPLIER_VERIFICATION_PENDING") {
    throw new ApplicationNotEditableError();
  }
  if (!EDITABLE_STATES.has(business.verification_status)) {
    throw new ApplicationAlreadyExistsError();
  }
}

const DRAFT_FIELDS = ["name", "type", "location", "established_year", "employees", "category", "description", "contact_email", "contact_phone", "website", "products_summary"];

// Create-or-update the caller's own business application draft. Never takes a business id from
// the caller — "your business" is always resolved server-side via getBusinessOwnedBy, so there
// is no id for one applicant to substitute and edit another applicant's business.
export function saveApplicationDraft(user, fields) {
  const existing = getBusinessOwnedBy.get(user.id);
  if (!existing && user.role !== "buyer") throw new OnlyBuyersCanApplyError();
  requireEditableOrThrow(existing);

  const record = { id: existing?.id || genId("BIZ") };
  for (const field of DRAFT_FIELDS) {
    record[field] = fields[field] ?? existing?.[field] ?? null;
  }

  if (existing) {
    updateBusinessDraft.run(record);
  } else {
    insertBusiness.run({ ...record, owner_user_id: user.id });
    recordAuditLog({
      actorUserId: user.id,
      action: `Started a supplier application (${record.name})`,
      targetType: "business",
      targetId: record.id,
    });
  }
  return getBusinessById.get(record.id);
}

export function getMyApplication(user) {
  const business = getBusinessOwnedBy.get(user.id);
  if (!business) return null;
  return {
    business,
    documents: listDocumentsForBusiness.all(business.id),
    images: listImagesForBusiness.all(business.id),
    transitions: listTransitionsForBusiness.all(business.id),
  };
}

export function submitApplication(user, { reason } = {}) {
  const business = getBusinessOwnedBy.get(user.id);
  if (!business) throw new BusinessNotFoundError();
  if (countDocumentsForBusiness.get(business.id).n === 0) {
    throw new ApplicationIncompleteError("Upload at least one business document before submitting.");
  }
  return applyVerificationTransition(business.id, "SUPPLIER_VERIFICATION_PENDING", {
    actorUserId: user.id,
    actorRole: user.role,
    reason,
  });
}

export function addDocument(user, { type, filePath }) {
  const business = getBusinessOwnedBy.get(user.id);
  if (!business) throw new BusinessNotFoundError();
  requireEditableOrThrow(business);
  const doc = { id: genId("DOC"), business_id: business.id, type, file_path: filePath, uploaded_by_user_id: user.id };
  insertDocument.run(doc);
  return getDocumentById.get(doc.id);
}

export function addImage(user, { caption, filePath }) {
  const business = getBusinessOwnedBy.get(user.id);
  if (!business) throw new BusinessNotFoundError();
  requireEditableOrThrow(business);
  const img = { id: genId("IMG"), business_id: business.id, file_path: filePath, caption: caption || null, uploaded_by_user_id: user.id };
  insertImage.run(img);
  return getImageById.get(img.id);
}

// Only ever called for the currently authenticated user's own business, so no extra ownership
// check is needed beyond confirming the document/image actually belongs to that business.
export function getMyDocumentFile(user, documentId) {
  const business = getBusinessOwnedBy.get(user.id);
  const doc = business && getDocumentById.get(documentId);
  if (!doc || doc.business_id !== business.id) throw new BusinessNotFoundError();
  return doc;
}
export function getMyImageFile(user, imageId) {
  const business = getBusinessOwnedBy.get(user.id);
  const img = business && getImageById.get(imageId);
  if (!img || img.business_id !== business.id) throw new BusinessNotFoundError();
  return img;
}

export function listApplicationsForAdmin({ status } = {}) {
  return status ? listApplicationsByStatus.all(status) : listAllApplications.all();
}

export function getApplicationForAdmin(businessId) {
  const business = getBusinessById.get(businessId);
  if (!business || !business.owner_user_id) throw new BusinessNotFoundError();
  return {
    business,
    documents: listDocumentsForBusiness.all(business.id),
    images: listImagesForBusiness.all(business.id),
    transitions: listTransitionsForBusiness.all(business.id),
  };
}
export function getAdminDocumentFile(businessId, documentId) {
  const doc = getDocumentById.get(documentId);
  if (!doc || doc.business_id !== businessId) throw new BusinessNotFoundError();
  return doc;
}
export function getAdminImageFile(businessId, imageId) {
  const img = getImageById.get(imageId);
  if (!img || img.business_id !== businessId) throw new BusinessNotFoundError();
  return img;
}

// Wraps applyVerificationTransition with the one side effect it deliberately doesn't own: when
// an application becomes SUPPLIER_VERIFIED, the applicant's account role flips from buyer to
// supplier. Kept out of applyVerificationTransition so that function stays a pure single-table
// mutator, same shape as orderStateMachine.applyTransition. The "AND role_key = 'buyer'" guard
// on the UPDATE makes re-verification (e.g. reinstating from SUPPLIER_RESTRICTED) a safe no-op
// instead of writing a misleading second "role changed" audit entry.
export function reviewTransition(adminUser, businessId, toState, reason) {
  const business = applyVerificationTransition(businessId, toState, {
    actorUserId: adminUser.id,
    actorRole: adminUser.role,
    reason,
  });

  if (toState === "SUPPLIER_VERIFIED" && business.owner_user_id) {
    const result = setUserRoleToSupplier.run(business.owner_user_id);
    if (result.changes > 0) {
      recordAuditLog({
        actorUserId: adminUser.id,
        action: `User ${business.owner_user_id} role changed from buyer to supplier (approved business ${businessId})`,
        targetType: "user",
        targetId: business.owner_user_id,
      });
    }
  }

  return business;
}
