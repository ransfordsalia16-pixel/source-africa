import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  createSupportRequest,
  listCasesForUser,
  listCasesForAdmin,
  getCaseWithNotes,
  assignCase,
  addNote,
  escalateCase,
  closeCase,
  CaseNotFoundError,
  CaseAccessDeniedError,
} from "../domain/cases.js";

const router = Router();

function handleDomainError(err, res) {
  if (err instanceof CaseNotFoundError || err instanceof CaseAccessDeniedError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

function serializeCase(row) {
  return {
    id: row.id,
    type: row.type,
    orderId: row.order_id,
    disputeId: row.dispute_id,
    subject: row.subject,
    description: row.description,
    status: row.status,
    assignedToUserId: row.assigned_to_user_id,
    createdAt: row.created_at,
  };
}
function serializeNote(row) {
  return { id: row.id, authorUserId: row.author_user_id, note: row.note, createdAt: row.created_at };
}

const supportRequestSchema = z.object({
  subject: z.string().trim().min(1, "A subject is required."),
  description: z.string().trim().optional(),
  orderId: z.string().trim().optional(),
});

router.post("/support-requests", requireAuth, (req, res) => {
  const parsed = supportRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request." });
  try {
    const record = createSupportRequest(req.user, parsed.data);
    res.status(201).json(serializeCase(record));
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.get("/support-requests", requireAuth, (req, res) => {
  res.json(listCasesForUser(req.user).map(serializeCase));
});

router.get("/admin/cases", requireAuth, requirePermission("support"), (req, res) => {
  const mine = req.query.mine === "true";
  res.json(listCasesForAdmin({ mine, adminUser: req.user }).map(serializeCase));
});

router.get("/admin/cases/:id", requireAuth, requirePermission("support"), (req, res) => {
  try {
    const { case: record, notes } = getCaseWithNotes(req.params.id);
    res.json({ case: serializeCase(record), notes: notes.map(serializeNote) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.post("/admin/cases/:id/assign", requireAuth, requirePermission("support"), (req, res) => {
  try {
    const { case: record, notes } = assignCase(req.params.id, req.user);
    res.json({ case: serializeCase(record), notes: notes.map(serializeNote) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

const noteSchema = z.object({ note: z.string().trim().min(1, "A note is required.") });

router.post("/admin/cases/:id/notes", requireAuth, requirePermission("support"), (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "A note is required." });
  try {
    const { case: record, notes } = addNote(req.params.id, req.user, parsed.data.note);
    res.json({ case: serializeCase(record), notes: notes.map(serializeNote) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.post("/admin/cases/:id/escalate", requireAuth, requirePermission("support"), (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "A note is required." });
  try {
    const { case: record, notes } = escalateCase(req.params.id, req.user, parsed.data.note);
    res.json({ case: serializeCase(record), notes: notes.map(serializeNote) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.post("/admin/cases/:id/close", requireAuth, requirePermission("support"), (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "A note is required." });
  try {
    const { case: record, notes } = closeCase(req.params.id, req.user, parsed.data.note);
    res.json({ case: serializeCase(record), notes: notes.map(serializeNote) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

export default router;
