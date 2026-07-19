import crypto from "node:crypto";

// RFC 6238 TOTP, implemented directly on node:crypto's HMAC rather than pulling in a dependency
// (otplib/speakeasy) — the algorithm is small and precisely specified, and this keeps the app
// installable without a network dependency step. 30-second step, 6 digits, SHA-1 (what every
// mainstream authenticator app — Google Authenticator, Authy, 1Password — expects by default).

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SECRET_BYTES = 20; // 160 bits, divides evenly into 5-bit base32 groups with no padding
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return output;
}

function base32Decode(base32) {
  const clean = base32.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error("Invalid base32 secret.");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function generateSecret() {
  return base32Encode(crypto.randomBytes(SECRET_BYTES));
}

export function buildOtpauthUrl(secret, email) {
  const issuer = "SourceBridge Africa";
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// Accepts a code from the current step or one step on either side, to tolerate ordinary clock
// drift between the server and the user's phone without meaningfully widening the guessable
// window (still only 3 valid 6-digit codes at any instant, same as any standard TOTP verifier).
export function verifyToken(secret, token) {
  if (typeof token !== "string" || !/^\d{6}$/.test(token)) return false;
  let secretBuffer;
  try {
    secretBuffer = base32Decode(secret);
  } catch {
    return false;
  }
  const currentStep = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let drift = -1; drift <= 1; drift++) {
    if (hotp(secretBuffer, currentStep + drift) === token) return true;
  }
  return false;
}
