import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  saveMyProfile,
  getMyProfile,
  listProfilesForAdmin,
  getProfileForAdmin,
  applyVerificationTransition,
  BuyerProfileNotFoundError,
  BuyerProfileNotEditableError,
  InvalidVerificationTransitionError,
  ForbiddenVerificationTransitionError,
} from "../domain/buyerVerification.js";

const router = Router();

function handleDomainError(err, res) {
  if (
    err instanceof BuyerProfileNotFoundError ||
    err instanceof BuyerProfileNotEditableError ||
    err instanceof InvalidVerificationTransitionError ||
    err instanceof ForbiddenVerificationTransitionError
  ) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

function serializeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    location: row.location,
    businessType: row.business_type,
    verificationStatus: row.verification_status,
    reviewNotes: row.review_notes,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const profileSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required."),
  location: z.string().trim().optional(),
  businessType: z.string().trim().optional(),
});

router.get("/buyer-profile/me", requireAuth, (req, res) => {
  res.json({ profile: serializeProfile(getMyProfile(req.user)) });
});

router.post("/buyer-profile/me", requireAuth, (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid company details." });

  const { companyName, location, businessType } = parsed.data;
  try {
    const profile = saveMyProfile(req.user, { company_name: companyName, location: location || null, business_type: businessType || null });
    res.status(201).json({ profile: serializeProfile(profile) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

router.get("/admin/buyer-profiles", requireAuth, requirePermission("verification"), (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json(listProfilesForAdmin({ status }).map(serializeProfile));
});

router.get("/admin/buyer-profiles/:id", requireAuth, requirePermission("verification"), (req, res) => {
  try {
    res.json(serializeProfile(getProfileForAdmin(req.params.id)));
  } catch (err) {
    handleDomainError(err, res);
  }
});

const transitionSchema = z.object({
  toState: z.enum(["BUYER_VERIFIED", "BUYER_REJECTED"]),
  reason: z.string().trim().min(1, "A reason is required."),
});

router.post("/admin/buyer-profiles/:id/transition", requireAuth, requirePermission("verification"), (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request." });
  try {
    const profile = applyVerificationTransition(req.params.id, parsed.data.toState, {
      actorUserId: req.user.id,
      actorRole: req.user.role,
      reason: parsed.data.reason,
    });
    res.json({ profile: serializeProfile(profile) });
  } catch (err) {
    handleDomainError(err, res);
  }
});

export default router;
