import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { genId } from "../util/id.js";
import {
  saveApplicationDraft,
  getMyApplication,
  submitApplication,
  addDocument,
  addImage,
  getMyDocumentFile,
  getMyImageFile,
  listApplicationsForAdmin,
  getApplicationForAdmin,
  getAdminDocumentFile,
  getAdminImageFile,
  reviewTransition,
  BusinessNotFoundError,
  InvalidVerificationTransitionError,
  ForbiddenVerificationTransitionError,
  ApplicationAlreadyExistsError,
  ApplicationNotEditableError,
  ApplicationIncompleteError,
  OnlyBuyersCanApplyError,
} from "../domain/supplierVerification.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const documentsRoot = path.resolve(__dirname, "../../uploads/business-documents");
const imagesRoot = path.resolve(__dirname, "../../uploads/business-images");

const router = Router();

function handleDomainError(err, res) {
  if (
    err instanceof BusinessNotFoundError ||
    err instanceof InvalidVerificationTransitionError ||
    err instanceof ForbiddenVerificationTransitionError ||
    err instanceof ApplicationAlreadyExistsError ||
    err instanceof ApplicationNotEditableError ||
    err instanceof ApplicationIncompleteError ||
    err instanceof OnlyBuyersCanApplyError
  ) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

// Same allow-list approach as routes/disputes.js: checked against the browser-reported MIME
// type (not the filename), backed up by multer's own fileSize limit.
const DOCUMENT_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };
const IMAGE_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function makeUploader(root, allowedTypes) {
  return multer({
    storage: multer.diskStorage({
      destination(req, _file, cb) {
        const business = getMyApplication(req.user);
        if (!business) return cb(new Error("NO_APPLICATION"));
        const dir = path.join(root, business.business.id);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename(_req, file, cb) {
        cb(null, `${genId("FILE")}${allowedTypes[file.mimetype] || ""}`);
      },
    }),
    limits: { fileSize: MAX_FILE_BYTES },
    fileFilter(_req, file, cb) {
      if (!allowedTypes[file.mimetype]) return cb(new Error("UNSUPPORTED_FILE_TYPE"));
      cb(null, true);
    },
  });
}
const uploadDocument = makeUploader(documentsRoot, DOCUMENT_TYPES);
const uploadImage = makeUploader(imagesRoot, IMAGE_TYPES);

function handleUploadError(err, res) {
  if (err.message === "NO_APPLICATION") return res.status(404).json({ error: "Start an application before uploading files." });
  const message =
    err.message === "UNSUPPORTED_FILE_TYPE"
      ? "That file type isn't accepted."
      : err.code === "LIMIT_FILE_SIZE"
        ? "That file is larger than the 10MB limit."
        : "Could not upload that file.";
  return res.status(400).json({ error: message });
}

function serializeBusiness(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    type: row.type,
    location: row.location,
    establishedYear: row.established_year,
    employees: row.employees,
    category: row.category,
    description: row.description,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    website: row.website,
    productsSummary: row.products_summary,
    trustLevel: row.trust_level,
    trustScore: row.trust_score,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function serializeDocument(row) {
  return { id: row.id, businessId: row.business_id, type: row.type, uploadedByUserId: row.uploaded_by_user_id, createdAt: row.created_at };
}
function serializeImage(row) {
  return { id: row.id, businessId: row.business_id, caption: row.caption, uploadedByUserId: row.uploaded_by_user_id, createdAt: row.created_at };
}
function serializeTransition(row) {
  return { id: row.id, fromState: row.from_state, toState: row.to_state, actorUserId: row.actor_user_id, reason: row.reason, createdAt: row.created_at };
}
function serializeApplication(app) {
  if (!app) return null;
  return {
    business: serializeBusiness(app.business),
    documents: app.documents.map(serializeDocument),
    images: app.images.map(serializeImage),
    transitions: app.transitions.map(serializeTransition),
  };
}

const draftSchema = z.object({
  name: z.string().trim().min(1, "Business name is required."),
  type: z.string().trim().optional(),
  location: z.string().trim().optional(),
  establishedYear: z.coerce.number().int().optional(),
  employees: z.string().trim().optional(),
  category: z.string().trim().optional(),
  description: z.string().trim().optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().optional(),
  website: z.string().trim().optional(),
  productsSummary: z.string().trim().optional(),
});

router.get("/business-applications/me", requireAuth, (req, res) => {
  res.json({ application: serializeApplication(getMyApplication(req.user)) });
});

router.post("/business-applications/me", requireAuth, (req, res) => {
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid business details." });
  const { establishedYear, contactEmail, contactPhone, productsSummary, ...rest } = parsed.data;
  try {
    const business = saveApplicationDraft(req.user, {
      ...rest,
      established_year: establishedYear ?? null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      products_summary: productsSummary ?? null,
    });
    res.status(201).json({ business: serializeBusiness(business) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

const submitSchema = z.object({ reason: z.string().trim().optional() });

router.post("/business-applications/me/submit", requireAuth, (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request." });
  try {
    const business = submitApplication(req.user, parsed.data);
    res.json({ business: serializeBusiness(business) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

const documentTypeSchema = z.object({
  type: z.enum(["business_license", "tax_certificate", "export_license", "bank_verification", "certification", "other"]),
});

router.post("/business-applications/me/documents", requireAuth, (req, res) => {
  uploadDocument.single("file")(req, res, (err) => {
    if (err) return handleUploadError(err, res);
    if (!req.file) return res.status(400).json({ error: "A file is required." });
    const parsed = documentTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "A valid document type is required." });
    }
    try {
      const relativePath = path.relative(documentsRoot, req.file.path);
      const doc = addDocument(req.user, { type: parsed.data.type, filePath: relativePath });
      res.status(201).json(serializeDocument(doc));
    } catch (domainErr) {
      fs.unlink(req.file.path, () => {});
      handleDomainError(domainErr, res);
    }
  });
});

router.get("/business-applications/me/documents/:documentId/file", requireAuth, (req, res) => {
  try {
    const doc = getMyDocumentFile(req.user, req.params.documentId);
    res.sendFile(path.join(documentsRoot, doc.file_path));
  } catch (err) {
    handleDomainError(err, res);
  }
});

const imageCaptionSchema = z.object({ caption: z.string().trim().optional() });

router.post("/business-applications/me/images", requireAuth, (req, res) => {
  uploadImage.single("file")(req, res, (err) => {
    if (err) return handleUploadError(err, res);
    if (!req.file) return res.status(400).json({ error: "A file is required." });
    const parsed = imageCaptionSchema.safeParse(req.body);
    if (!parsed.success) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Invalid image details." });
    }
    try {
      const relativePath = path.relative(imagesRoot, req.file.path);
      const img = addImage(req.user, { caption: parsed.data.caption, filePath: relativePath });
      res.status(201).json(serializeImage(img));
    } catch (domainErr) {
      fs.unlink(req.file.path, () => {});
      handleDomainError(domainErr, res);
    }
  });
});

router.get("/business-applications/me/images/:imageId/file", requireAuth, (req, res) => {
  try {
    const img = getMyImageFile(req.user, req.params.imageId);
    res.sendFile(path.join(imagesRoot, img.file_path));
  } catch (err) {
    handleDomainError(err, res);
  }
});

// --- Admin review ---------------------------------------------------------

router.get("/admin/business-applications", requireAuth, requirePermission("verification"), (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json(listApplicationsForAdmin({ status }).map(serializeBusiness));
});

router.get("/admin/business-applications/:id", requireAuth, requirePermission("verification"), (req, res) => {
  try {
    res.json(serializeApplication(getApplicationForAdmin(req.params.id)));
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.get("/admin/business-applications/:id/documents/:documentId/file", requireAuth, requirePermission("verification"), (req, res) => {
  try {
    const doc = getAdminDocumentFile(req.params.id, req.params.documentId);
    res.sendFile(path.join(documentsRoot, doc.file_path));
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.get("/admin/business-applications/:id/images/:imageId/file", requireAuth, requirePermission("verification"), (req, res) => {
  try {
    const img = getAdminImageFile(req.params.id, req.params.imageId);
    res.sendFile(path.join(imagesRoot, img.file_path));
  } catch (err) {
    handleDomainError(err, res);
  }
});

const transitionSchema = z.object({
  toState: z.enum(["SUPPLIER_VERIFIED", "SUPPLIER_REJECTED", "SUPPLIER_RESTRICTED", "SUPPLIER_SUSPENDED"]),
  reason: z.string().trim().min(1, "A reason is required."),
});

router.post("/admin/business-applications/:id/transition", requireAuth, requirePermission("verification"), (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request." });
  try {
    const business = reviewTransition(req.user, req.params.id, parsed.data.toState, parsed.data.reason);
    res.json({ business: serializeBusiness(business) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

export default router;
