import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";
import { generateSecret, buildOtpauthUrl, verifyToken } from "../security/totp.js";
import { encrypt, decrypt } from "../security/encryption.js";

export class InvalidCodeError extends Error {
  constructor() {
    super("That code isn't valid. Check your authenticator app and try again.");
    this.status = 400;
  }
}
export class NoPendingEnrollmentError extends Error {
  constructor() {
    super("Start enrollment before confirming a code.");
    this.status = 409;
  }
}
export class InvalidPasswordError extends Error {
  constructor() {
    super("Your current password is incorrect.");
    this.status = 401;
  }
}
export class MfaNotEnabledError extends Error {
  constructor() {
    super("Two-factor sign-in isn't turned on for this account.");
    this.status = 409;
  }
}

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — avoids misreads

function generateBackupCode() {
  let code = "";
  for (let i = 0; i < 10; i++) {
    if (i === 5) code += "-";
    code += BACKUP_CODE_CHARSET[crypto.randomInt(BACKUP_CODE_CHARSET.length)];
  }
  return code;
}

const getUserFull = db.prepare("SELECT * FROM users WHERE id = ?");
const setPendingSecret = db.prepare("UPDATE users SET mfa_pending_secret_encrypted = ? WHERE id = ?");
const promoteSecret = db.prepare("UPDATE users SET mfa_secret_encrypted = ?, mfa_pending_secret_encrypted = NULL, mfa_enabled = 1 WHERE id = ?");
const clearMfa = db.prepare("UPDATE users SET mfa_secret_encrypted = NULL, mfa_pending_secret_encrypted = NULL, mfa_enabled = 0 WHERE id = ?");
const insertBackupCode = db.prepare("INSERT INTO mfa_backup_codes (id, user_id, code_hash) VALUES (?, ?, ?)");
const deleteBackupCodes = db.prepare("DELETE FROM mfa_backup_codes WHERE user_id = ?");
const getUnusedBackupCodes = db.prepare("SELECT * FROM mfa_backup_codes WHERE user_id = ? AND used_at IS NULL");
const markBackupCodeUsed = db.prepare("UPDATE mfa_backup_codes SET used_at = datetime('now') WHERE id = ?");

// Generates a new secret and parks it as "pending" — mfa_enabled stays 0 and the live
// mfa_secret_encrypted (if any) is untouched until confirmEnrollment proves the user can
// actually produce a valid code with it. The plaintext secret is returned here and only here;
// after this call it only ever exists encrypted at rest.
export function startEnrollment(user) {
  const secret = generateSecret();
  setPendingSecret.run(encrypt(secret), user.id);
  recordAuditLog({ actorUserId: user.id, action: "Started two-factor sign-in enrollment", targetType: "user", targetId: user.id });
  return { secret, otpauthUrl: buildOtpauthUrl(secret, user.email) };
}

export function confirmEnrollment(user, code) {
  const row = getUserFull.get(user.id);
  if (!row.mfa_pending_secret_encrypted) throw new NoPendingEnrollmentError();

  const secret = decrypt(row.mfa_pending_secret_encrypted);
  if (!verifyToken(secret, code)) throw new InvalidCodeError();

  promoteSecret.run(encrypt(secret), user.id);
  deleteBackupCodes.run(user.id); // re-enrolling invalidates any old codes

  const backupCodes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const plain = generateBackupCode();
    backupCodes.push(plain);
    insertBackupCode.run(genId("BKC"), user.id, bcrypt.hashSync(plain, 10));
  }

  recordAuditLog({ actorUserId: user.id, action: "Turned on two-factor sign-in", targetType: "user", targetId: user.id });
  return { backupCodes };
}

export function disableMfa(user, currentPassword) {
  const row = getUserFull.get(user.id);
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) throw new InvalidPasswordError();
  if (!row.mfa_enabled) throw new MfaNotEnabledError();

  clearMfa.run(user.id);
  deleteBackupCodes.run(user.id);
  recordAuditLog({ actorUserId: user.id, action: "Turned off two-factor sign-in", targetType: "user", targetId: user.id });
}

// Tries the TOTP code first, then an unused backup code. Only ever called from the second step
// of login (routes/auth.js's POST /login/mfa), after the password has already been verified —
// this function is never a substitute for that check, only what comes after it.
export function verifyLoginCode(userId, code) {
  const row = getUserFull.get(userId);
  if (!row?.mfa_enabled || !row.mfa_secret_encrypted) return false;

  const secret = decrypt(row.mfa_secret_encrypted);
  if (verifyToken(secret, code)) return true;

  for (const backup of getUnusedBackupCodes.all(userId)) {
    if (bcrypt.compareSync(code, backup.code_hash)) {
      markBackupCodeUsed.run(backup.id);
      return true;
    }
  }
  return false;
}
