// Mirrors sourcebridge-server/src/domain/orderAccess.js's ADMIN_ROLES. The backend has several
// granular admin role_keys (super_admin, finance_admin, dispute_officer, ...); the frontend's
// routing, sidebar nav, and ProtectedRoute all key off three buckets (buyer/supplier/admin), so
// every one of those granular roles maps to the single "admin" bucket here. This mapping is a
// fixed function of whatever role_key the server returned at login — never something a button
// click or client choice influences — so it stays true to "the server determines the role."
export const ADMIN_ROLES = ["super_admin", "finance_admin", "dispute_officer", "customer_support", "verification_team", "security_admin"];

export function toFrontendRole(serverRole) {
  return ADMIN_ROLES.includes(serverRole) ? "admin" : serverRole;
}
