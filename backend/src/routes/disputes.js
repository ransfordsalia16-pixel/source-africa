import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission, requireRole } from "../middleware/rbac.js";
import { genId } from "../util/id.js";
import {
  openDispute,
  listDisputesForUser,
  listAllDisputes,
  getDisputeIfAccessible,
  listEvidence,
  addEvidence,
  getEvidenceIfAccessible,
  assignReviewer,
  resolveDispute,
  OrderAccessDeniedError,
  DisputeNotFoundError,
  DisputeStateError,
} from "../domain/disputes.js";
import { InvalidTransitionError, ForbiddenTransitionError } from "../domain/orderStateMachine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, "../../uploads/evidence");

const router = Router();

function handleDomainError(err, res) {
  if (
    err instanceof OrderAccessDeniedError ||
    err instanceof DisputeNotFoundError ||
    err instanceof DisputeStateError ||
    err instanceof InvalidTransitionError ||
    err instanceof ForbiddenTransitionError
  ) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

// Only these survive the allow-list. Anything else, including a file whose extension was
// renamed to look like one of these, is still rejected because the check is on the browser-
// reported MIME type, not the filename — and multer's own limits.fileSize cap backs up any
// client that lies about size in the multipart headers.
const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const dir = path.join(uploadsRoot, req.params.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      cb(null, `${genId("FILE")}${ALLOWED_TYPES[file.mimetype] || ""}`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
    cb(null, true);
  },
});

function serializeDispute(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    openedBy: row.opened_by_user_id,
    reason: row.reason,
    description: row.description,
    status: row.status,
    assignedReviewerId: row.assigned_reviewer_id,
    resolution: row.resolution,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}
function serializeEvidence(row) {
  return {
    id: row.id,
    disputeId: row.dispute_id,
    uploadedBy: row.uploaded_by_user_id,
    type: row.type,
    description: row.description,
    createdAt: row.created_at,
  };
}

const openDisputeSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required."),
  description: z.string().trim().optional(),
});

router.post("/orders/:id/disputes", requireAuth, (req, res) => {
  const parsed = openDisputeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid dispute details." });

  try {
    const { dispute, order } = openDispute(req.params.id, req.user, parsed.data);
    res.status(201).json({ dispute: serializeDispute(dispute), order });
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.get("/disputes", requireAuth, (req, res) => {
  res.json(listDisputesForUser(req.user).map(serializeDispute));
});

router.get("/disputes/:id", requireAuth, (req, res) => {
  try {
    const { dispute } = getDisputeIfAccessible(req.user, req.params.id);
    res.json({ dispute: serializeDispute(dispute), evidence: listEvidence(dispute.id).map(serializeEvidence) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

const evidenceMetaSchema = z.object({
  type: z.enum(["product_photo", "product_video", "invoice", "shipping_document", "delivery_confirmation", "inspection_report", "other"]).optional(),
  description: z.string().trim().optional(),
});

router.post("/disputes/:id/evidence", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const message = err.message === "UNSUPPORTED_FILE_TYPE"
        ? "Only JPG, PNG, WEBP, and PDF files are accepted."
        : err.code === "LIMIT_FILE_SIZE"
          ? "That file is larger than the 10MB limit."
          : "Could not upload that file.";
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "A file is required." });

    const parsed = evidenceMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid evidence details." });
    }

    try {
      const relativePath = path.relative(uploadsRoot, req.file.path);
      const evidence = addEvidence(req.params.id, req.user, { ...parsed.data, filePath: relativePath });
      res.status(201).json(serializeEvidence(evidence));
    } catch (domainErr) {
      fs.unlink(req.file.path, () => {});
      handleDomainError(domainErr, res);
    }
  });
});

router.get("/disputes/:id/evidence/:evidenceId/file", requireAuth, (req, res) => {
  try {
    const evidence = getEvidenceIfAccessible(req.user, req.params.id, req.params.evidenceId);
    const filePath = path.join(uploadsRoot, evidence.file_path);
    // The evidence row only ever stores a path this server generated (see the multer filename()
    // above), never anything derived from user input, so this can't be walked outside uploadsRoot.
    res.sendFile(filePath);
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.get("/admin/disputes", requireAuth, requirePermission("disputes"), (_req, res) => {
  res.json(listAllDisputes().map(serializeDispute));
});

router.get("/admin/disputes/:id", requireAuth, requirePermission("disputes"), (req, res) => {
  const dispute = listAllDisputes().find((d) => d.id === req.params.id);
  if (!dispute) return res.status(404).json({ error: "Dispute not found." });
  res.json({ dispute: serializeDispute(dispute), evidence: listEvidence(dispute.id).map(serializeEvidence) });
});

// Assigning a case and resolving it are gated more narrowly than plain "disputes" visibility —
// role_permissions.disputes also covers customer_support (who can view and escalate cases per
// the platform's RBAC model), but taking ownership of a case and releasing or refunding money is
// reserved for the roles who actually decide outcomes.
router.post("/admin/disputes/:id/assign", requireAuth, requireRole("dispute_officer", "super_admin"), (req, res) => {
  try {
    const { dispute, order } = assignReviewer(req.params.id, req.user);
    res.json({ dispute: serializeDispute(dispute), order });
  } catch (err) {
    handleDomainError(err, res);
  }
});

const resolveSchema = z.object({
  outcome: z.enum(["supplier", "buyer"]),
  resolution: z.string().trim().min(1, "Resolution notes are required."),
});

router.post("/admin/disputes/:id/resolve", requireAuth, requireRole("dispute_officer", "super_admin"), (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid resolution." });

  try {
    const { dispute, order } = resolveDispute(req.params.id, req.user, parsed.data);
    res.json({ dispute: serializeDispute(dispute), order });
  } catch (err) {
    handleDomainError(err, res);
  }
});

export default router;
