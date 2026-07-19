import { db } from "../db/connection.js";

const getPermissions = db.prepare("SELECT * FROM role_permissions WHERE role_key = ?");

// requirePermission("payments") only lets the request through if role_permissions says this
// user's role is allowed to touch payments. This reads the same table the admin Security page
// displays, so what the UI shows as "who can do what" is the same thing the server enforces.
export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not signed in." });
    const perms = getPermissions.get(req.user.role);
    if (!perms || !perms[permissionKey]) {
      return res.status(403).json({ error: `Your role does not have ${permissionKey} access.` });
    }
    next();
  };
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not signed in." });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Your role cannot perform this action." });
    }
    next();
  };
}
