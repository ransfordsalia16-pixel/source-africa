import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const getUserById = db.prepare(`
  SELECT u.id, u.email, u.name, u.role_key AS role, u.location, u.avatar_initials AS avatarInitials,
         u.mfa_enabled AS mfaEnabled, u.last_login_at AS lastLoginAt
  FROM users u WHERE u.id = ?
`);

// Every protected route runs through this. There is no "trust the frontend" path: if the
// Authorization header is missing or the token is invalid/expired, the request never reaches
// a route handler.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // An mfaPending token (see routes/auth.js's issueMfaPendingToken) only proves a password was
    // checked, not that the second factor was — it must never be accepted here as a real session,
    // even though it's a validly-signed token from this same server.
    if (payload.mfaPending) return res.status(401).json({ error: "Two-factor verification is required to finish signing in." });
    const user = getUserById.get(payload.sub);
    if (!user) return res.status(401).json({ error: "Session no longer valid." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}
