import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { recordAuditLog } from "../audit/log.js";
import { genId } from "../util/id.js";
import {
  startEnrollment,
  confirmEnrollment,
  disableMfa,
  verifyLoginCode,
  InvalidCodeError,
  NoPendingEnrollmentError,
  InvalidPasswordError,
  MfaNotEnabledError,
} from "../domain/mfa.js";

const router = Router();

// A 6-digit code has only 1,000,000 combinations — this endpoint needs a much tighter limit
// than the general authLimiter index.js already applies to this whole router.
const mfaLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  intent: z.enum(["buy", "sell", "both"]).optional(),
});

const getByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const touchLastLogin = db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?");
const getPublicUser = db.prepare(`
  SELECT id, email, name, role_key AS role, location, avatar_initials AS avatarInitials,
         mfa_enabled AS mfaEnabled, last_login_at AS lastLoginAt, onboarding_intent AS onboardingIntent
  FROM users WHERE id = ?
`);
const insertUser = db.prepare(`
  INSERT INTO users (id, email, password_hash, name, role_key, onboarding_intent)
  VALUES (@id, @email, @password_hash, @name, @role_key, @onboarding_intent)
`);

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role_key }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  });
}

// Short-lived, single-purpose token proving "this account's password was just verified" —
// nothing more. Carries mfaPending: true so requireAuth (see middleware/auth.js) refuses to
// accept it as a real session, even if someone tries to replay it against a protected route.
function issueMfaPendingToken(user) {
  return jwt.sign({ sub: user.id, mfaPending: true }, process.env.JWT_SECRET, { expiresIn: "5m" });
}

router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const { email, password } = parsed.data;

  const user = getByEmail.get(email);
  // Same error message whether the email doesn't exist or the password is wrong, so a caller
  // can't use this endpoint to discover which emails are registered.
  const invalid = () => res.status(401).json({ error: "Email or password is incorrect." });
  if (!user) return invalid();

  const passwordOk = bcrypt.compareSync(password, user.password_hash);
  if (!passwordOk) return invalid();

  if (user.mfa_enabled) {
    // Deliberately does not touch last_login_at or write the "signed in" audit entry yet —
    // those happen once the second factor actually clears, in POST /login/mfa below.
    return res.json({ mfaRequired: true, mfaToken: issueMfaPendingToken(user) });
  }

  touchLastLogin.run(user.id);
  recordAuditLog({ actorUserId: user.id, action: "User signed in", targetType: "user", targetId: user.id });

  res.json({ token: issueToken(user), user: getPublicUser.get(user.id) });
});

const mfaLoginSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().trim().min(1),
});

router.post("/login/mfa", mfaLoginLimiter, (req, res) => {
  const parsed = mfaLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A code is required." });

  let payload;
  try {
    payload = jwt.verify(parsed.data.mfaToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Your sign-in attempt has expired. Start again." });
  }
  if (!payload.mfaPending) {
    return res.status(401).json({ error: "Your sign-in attempt has expired. Start again." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
  if (!user || !verifyLoginCode(user.id, parsed.data.code)) {
    recordAuditLog({ actorUserId: payload.sub, action: "Rejected an incorrect two-factor code at sign-in", targetType: "user", targetId: payload.sub });
    return res.status(401).json({ error: "That code isn't valid." });
  }

  touchLastLogin.run(user.id);
  recordAuditLog({ actorUserId: user.id, action: "User signed in (two-factor)", targetType: "user", targetId: user.id });

  res.json({ token: issueToken(user), user: getPublicUser.get(user.id) });
});

// Public self-registration. Regardless of what the caller sends as "intent", this always
// creates the account with role_key = 'buyer' — there is no request body field, present or
// absent, that can make this endpoint create a supplier or admin account. Becoming a supplier
// is a separate verification process the account can start later (see
// routes/businessApplications.js); becoming an admin is never self-service at all.
router.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid registration details." });
  }
  const { name, email, password, intent } = parsed.data;

  if (getByEmail.get(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const user = {
    id: genId("USR"),
    email,
    password_hash: bcrypt.hashSync(password, 10),
    name,
    role_key: "buyer",
    onboarding_intent: intent || null,
  };
  insertUser.run(user);
  recordAuditLog({ actorUserId: user.id, action: "User registered an account", targetType: "user", targetId: user.id });

  res.status(201).json({ token: issueToken(user), user: getPublicUser.get(user.id) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

function handleMfaError(err, res) {
  if (
    err instanceof InvalidCodeError ||
    err instanceof NoPendingEnrollmentError ||
    err instanceof InvalidPasswordError ||
    err instanceof MfaNotEnabledError
  ) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

router.post("/mfa/enroll", requireAuth, (req, res) => {
  const { secret, otpauthUrl } = startEnrollment(req.user);
  res.json({ secret, otpauthUrl });
});

const confirmSchema = z.object({ code: z.string().trim().min(1, "A code is required.") });

router.post("/mfa/confirm", requireAuth, (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A code is required." });
  try {
    const { backupCodes } = confirmEnrollment(req.user, parsed.data.code);
    res.json({ enabled: true, backupCodes });
  } catch (err) {
    handleMfaError(err, res);
  }
});

const disableSchema = z.object({ currentPassword: z.string().min(1, "Your current password is required.") });

router.post("/mfa/disable", requireAuth, (req, res) => {
  const parsed = disableSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Your current password is required." });
  try {
    disableMfa(req.user, parsed.data.currentPassword);
    res.json({ enabled: false });
  } catch (err) {
    handleMfaError(err, res);
  }
});

export default router;
