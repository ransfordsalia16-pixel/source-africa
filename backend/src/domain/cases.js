import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";
import { getOrderIfAccessible } from "./orderAccess.js";

export class CaseNotFoundError extends Error {
  constructor() {
    super("Case not found.");
    this.status = 404;
  }
}
export class CaseAccessDeniedError extends Error {
  constructor(message = "That order could not be found.") {
    super(message);
    this.status = 404;
  }
}

const getCaseById = db.prepare("SELECT * FROM support_cases WHERE id = ?");
const insertCase = db.prepare(`
  INSERT INTO support_cases (id, type, order_id, dispute_id, opened_by_user_id, subject, description)
  VALUES (@id, @type, @order_id, @dispute_id, @opened_by_user_id, @subject, @description)
`);
const listForOpener = db.prepare("SELECT * FROM support_cases WHERE opened_by_user_id = ? ORDER BY created_at DESC");
const listAllStmt = db.prepare("SELECT * FROM support_cases ORDER BY created_at DESC");
const listMineStmt = db.prepare("SELECT * FROM support_cases WHERE assigned_to_user_id = ? ORDER BY created_at DESC");
const setAssigned = db.prepare("UPDATE support_cases SET assigned_to_user_id = ?, status = 'open' WHERE id = ?");
const setEscalated = db.prepare("UPDATE support_cases SET assigned_to_user_id = NULL, status = 'escalated' WHERE id = ?");
const setClosed = db.prepare("UPDATE support_cases SET status = 'closed' WHERE id = ?");

const insertNote = db.prepare("INSERT INTO case_notes (id, case_id, author_user_id, note) VALUES (?, ?, ?, ?)");
const listNotesStmt = db.prepare("SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at ASC");

function addNoteRow(caseId, authorUserId, note) {
  insertNote.run(genId("NOTE"), caseId, authorUserId, note);
}

// Called from domain/disputes.js's openDispute() — every dispute is trackable as a case from
// the moment it's opened, using the dispute's own reason/description as the case's subject so
// the requester's own words show up on both sides of the system.
export function createCaseForDispute(dispute, order) {
  const record = {
    id: genId("CASE"),
    type: "dispute",
    order_id: order.id,
    dispute_id: dispute.id,
    opened_by_user_id: dispute.opened_by_user_id,
    subject: dispute.reason,
    description: dispute.description || null,
  };
  insertCase.run(record);
  return getCaseById.get(record.id);
}

export function createSupportRequest(user, { subject, description, orderId }) {
  let order = null;
  if (orderId) {
    order = getOrderIfAccessible(user, orderId);
    if (!order) throw new CaseAccessDeniedError();
  }
  const record = {
    id: genId("CASE"),
    type: "support_request",
    order_id: order ? order.id : null,
    dispute_id: null,
    opened_by_user_id: user.id,
    subject,
    description: description || null,
  };
  insertCase.run(record);
  recordAuditLog({ actorUserId: user.id, action: `Submitted a support request: ${subject}`, targetType: "case", targetId: record.id });
  return getCaseById.get(record.id);
}

// Metadata only — subject, description (the requester's own words), status. Never includes
// case_notes, which is the internal staff-only log.
export function listCasesForUser(user) {
  return listForOpener.all(user.id);
}

export function listCasesForAdmin({ mine, adminUser }) {
  return mine ? listMineStmt.all(adminUser.id) : listAllStmt.all();
}

export function getCaseWithNotes(caseId) {
  const record = getCaseById.get(caseId);
  if (!record) throw new CaseNotFoundError();
  return { case: record, notes: listNotesStmt.all(caseId) };
}

export function assignCase(caseId, adminUser) {
  if (!getCaseById.get(caseId)) throw new CaseNotFoundError();
  setAssigned.run(adminUser.id, caseId);
  addNoteRow(caseId, adminUser.id, "Took this case for review.");
  recordAuditLog({ actorUserId: adminUser.id, action: `Took case ${caseId} for review`, targetType: "case", targetId: caseId });
  return getCaseWithNotes(caseId);
}

export function addNote(caseId, adminUser, note) {
  if (!getCaseById.get(caseId)) throw new CaseNotFoundError();
  addNoteRow(caseId, adminUser.id, note);
  recordAuditLog({ actorUserId: adminUser.id, action: `Added a note to case ${caseId}`, targetType: "case", targetId: caseId });
  return getCaseWithNotes(caseId);
}

export function escalateCase(caseId, adminUser, note) {
  if (!getCaseById.get(caseId)) throw new CaseNotFoundError();
  setEscalated.run(caseId);
  addNoteRow(caseId, adminUser.id, `Escalated: ${note}`);
  recordAuditLog({ actorUserId: adminUser.id, action: `Escalated case ${caseId}`, targetType: "case", targetId: caseId, reason: note });
  return getCaseWithNotes(caseId);
}

export function closeCase(caseId, adminUser, note) {
  if (!getCaseById.get(caseId)) throw new CaseNotFoundError();
  setClosed.run(caseId);
  addNoteRow(caseId, adminUser.id, `Closed: ${note}`);
  recordAuditLog({ actorUserId: adminUser.id, action: `Closed case ${caseId}`, targetType: "case", targetId: caseId, reason: note });
  return getCaseWithNotes(caseId);
}

// The function routes/conversations.js calls instead of just checking for a non-blank reason
// string: the case has to exist, belong to the same order as the conversation, and be assigned
// to this admin — or the admin is super_admin, who (like everywhere else in this app) can act
// on any case the same way they can access any order.
export function caseGrantsConversationAccess(caseId, adminUser, orderId) {
  const record = getCaseById.get(caseId);
  if (!record) return false;
  if (record.order_id !== orderId) return false;
  if (adminUser.role === "super_admin") return true;
  return record.assigned_to_user_id === adminUser.id;
}
