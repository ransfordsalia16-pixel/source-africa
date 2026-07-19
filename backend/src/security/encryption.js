import crypto from "node:crypto";

// TOTP secrets are sensitive enough not to sit in plaintext next to password hashes — this is
// the one place that encrypts/decrypts them, using AES-256-GCM (authenticated: a tampered
// ciphertext fails to decrypt rather than silently returning garbage). MFA_ENCRYPTION_KEY
// follows the same "required, 32-byte hex, throws clearly if missing" convention already used
// for JWT_SECRET/WEBHOOK_SECRET in db/connection.js and payments/MockPaymentProvider.js.
function getKey() {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) throw new Error("MFA_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be a 32-byte (64 hex character) value.");
  return key;
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(payload) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
