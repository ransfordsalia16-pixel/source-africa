import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";

// Smaller than domain/supplierVerification.js's state machine on purpose — buyer verification
// is a trust indicator, not a role/permission grant, and there's nothing equivalent to a
// supplier's active listings that would need pulling from the marketplace, so there's no
// restrict/suspend here.
export const TRANSITIONS = {
  BUYER_VERIFICATION_PENDING: ["BUYER_VERIFIED", "BUYER_REJECTED"],
  BUYER_REJECTED: ["BUYER_VERIFICATION_PENDING"],
};

const ROLE_RULES = {
  "BUYER_REJECTED:BUYER_VERIFICATION_PENDING": ["buyer"],
  "BUYER_VERIFICATION_PENDING:BUYER_VERIFIED": ["super_admin", "verification_team"],
  "BUYER_VERIFICATION_PENDING:BUYER_REJECTED": ["super_admin", "verification_team"],
};

export class BuyerProfileNotFoundError extends Error {
  constructor() {
    super("Buyer profile not found.");
    this.status = 404;
  }
}
// Thrown when trying to edit a profile that's under review or already verified — this phase
// only allows editing before first submission (handled by insert, not this class) or after a
// rejection.
export class BuyerProfileNotEditableError extends Error {
  constructor() {
    super("Your company profile can't be edited right now.");
    this.status = 409;
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

const getByUserId = db.prepare("SELECT * FROM buyer_profiles WHERE user_id = ?");
const getById = db.prepare("SELECT * FROM buyer_profiles WHERE id = ?");
const insertProfile = db.prepare(`
  INSERT INTO buyer_profiles (id, user_id, company_name, location, business_type, verification_status)
  VALUES (@id, @user_id, @company_name, @location, @business_type, 'BUYER_VERIFICATION_PENDING')
`);
const updateProfileFields = db.prepare(`
  UPDATE buyer_profiles SET company_name = @company_name, location = @location, business_type = @business_type, updated_at = datetime('now')
  WHERE id = @id
`);
const updateStatus = db.prepare(`
  UPDATE buyer_profiles
  SET verification_status = @status, review_notes = @reason, reviewed_by_user_id = @reviewed_by, reviewed_at = @reviewed_at, updated_at = datetime('now')
  WHERE id = @id
`);
const listAll = db.prepare("SELECT * FROM buyer_profiles ORDER BY created_at DESC");
const listByStatus = db.prepare("SELECT * FROM buyer_profiles WHERE verification_status = ? ORDER BY created_at DESC");

/**
 * The only function allowed to change buyer_profiles.verification_status — mirrors
 * domain/supplierVerification.js's applyVerificationTransition. Admin edges (identified by
 * actorRole not being "buyer") stamp reviewed_by/reviewed_at; the buyer's own resubmit edge
 * does not.
 */
export function applyVerificationTransition(profileId, toState, { actorUserId = null, actorRole, reason = null } = {}) {
  const profile = getById.get(profileId);
  if (!profile) throw new BuyerProfileNotFoundError();

  const fromState = profile.verification_status;
  const allowedNext = TRANSITIONS[fromState] || [];
  if (!allowedNext.includes(toState)) {
    throw new InvalidVerificationTransitionError(`Cannot move a buyer profile from ${fromState} to ${toState}.`);
  }

  const ruleKey = `${fromState}:${toState}`;
  const allowedRoles = ROLE_RULES[ruleKey] || [];
  if (!allowedRoles.includes(actorRole)) {
    throw new ForbiddenVerificationTransitionError(`Your role cannot move a buyer profile from ${fromState} to ${toState}.`);
  }

  const isAdminEdge = actorRole !== "buyer";
  updateStatus.run({
    id: profileId,
    status: toState,
    reason,
    reviewed_by: isAdminEdge ? actorUserId : profile.reviewed_by_user_id,
    reviewed_at: isAdminEdge ? new Date().toISOString() : profile.reviewed_at,
  });
  recordAuditLog({
    actorUserId,
    action: `Buyer profile ${profileId} moved from ${fromState} to ${toState}`,
    targetType: "buyer_profile",
    targetId: profileId,
    reason,
  });

  return getById.get(profileId);
}

// Create-or-resubmit: no existing profile creates one directly at BUYER_VERIFICATION_PENDING
// (no separate submit step, unlike supplier applications, since there's no document-gathering
// stage here). An existing BUYER_REJECTED profile can be edited and moved back to pending in
// the same call. Anything else (PENDING or VERIFIED already) is locked this phase.
export function saveMyProfile(user, fields) {
  const existing = getByUserId.get(user.id);

  if (!existing) {
    const record = { id: genId("BYR"), user_id: user.id, ...fields };
    insertProfile.run(record);
    return getById.get(record.id);
  }

  if (existing.verification_status !== "BUYER_REJECTED") {
    throw new BuyerProfileNotEditableError();
  }

  updateProfileFields.run({ id: existing.id, ...fields });
  return applyVerificationTransition(existing.id, "BUYER_VERIFICATION_PENDING", {
    actorUserId: user.id,
    actorRole: user.role,
  });
}

export function getMyProfile(user) {
  return getByUserId.get(user.id) || null;
}

export function listProfilesForAdmin({ status } = {}) {
  return status ? listByStatus.all(status) : listAll.all();
}

export function getProfileForAdmin(id) {
  const profile = getById.get(id);
  if (!profile) throw new BuyerProfileNotFoundError();
  return profile;
}
