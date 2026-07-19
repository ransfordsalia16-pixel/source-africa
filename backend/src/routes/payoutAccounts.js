import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  getMyPayoutAccount,
  requestPayoutAccountChange,
  NoVerifiedBusinessError,
  InvalidPasswordError,
} from "../domain/payoutAccounts.js";

const router = Router();

function handleDomainError(err, res) {
  if (err instanceof NoVerifiedBusinessError || err instanceof InvalidPasswordError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

function serializeAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    maskedDetails: row.masked_details,
    status: row.status,
    createdAt: row.created_at,
    activatesAt: row.activates_at,
  };
}

router.get("/payout-account/mine", requireAuth, (req, res) => {
  const { active, pending } = getMyPayoutAccount(req.user);
  res.json({ active: serializeAccount(active), pending: pending.map(serializeAccount) });
});

const changeSchema = z.object({
  type: z.enum(["bank", "mobile_money"]),
  currentPassword: z.string().min(1, "Your current password is required."),
  details: z.object({
    bankName: z.string().trim().optional(),
    provider: z.string().trim().optional(),
    accountNumber: z.string().trim().optional(),
    phoneNumber: z.string().trim().optional(),
  }),
});

// A payout-destination change is exactly the kind of high-risk action worth its own tight
// limit, separate from the general API — a handful of attempts per window is enough for a
// legitimate correction, and slows down anyone trying to brute-force the password check above.
const payoutChangeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

router.post("/payout-account/mine", requireAuth, payoutChangeLimiter, (req, res) => {
  const parsed = changeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payout account details." });

  try {
    const account = requestPayoutAccountChange(req.user, parsed.data);
    res.status(201).json(serializeAccount(account));
  } catch (err) {
    handleDomainError(err, res);
  }
});

export default router;
