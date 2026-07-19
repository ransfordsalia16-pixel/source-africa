import { db } from "../db/connection.js";

export const ADMIN_ROLES = ["super_admin", "finance_admin", "dispute_officer", "customer_support", "verification_team", "security_admin"];

export const getOrderRow = db.prepare("SELECT * FROM orders WHERE id = ?");
export const getBusinessOwnedBy = db.prepare("SELECT * FROM businesses WHERE owner_user_id = ?");
export const getBusinessById = db.prepare("SELECT * FROM businesses WHERE id = ?");

// Every order-scoped read or write in the app is gated by this. A buyer only ever sees orders
// where they are the buyer; a supplier only ever sees orders against their own business; nobody
// gets an unscoped "give me any order" path except the admin roles that are supposed to see
// everything. Reused by routes/orders.js and routes/conversations.js so there is exactly one
// IDOR check in the codebase, not a second copy that could drift out of sync.
export function canAccessOrder(user, order, supplierBusiness) {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.role === "buyer") return order.buyer_id === user.id;
  if (user.role === "supplier") return !!supplierBusiness && supplierBusiness.id === order.supplier_business_id;
  return false;
}

// Resolves the "supplier business" side of the access check for whichever user is asking.
export function resolveSupplierBusiness(user, order) {
  return user.role === "supplier" ? getBusinessOwnedBy.get(user.id) : getBusinessById.get(order.supplier_business_id);
}

export function getOrderIfAccessible(user, orderId) {
  const order = getOrderRow.get(orderId);
  if (!order) return null;
  const supplierBusiness = resolveSupplierBusiness(user, order);
  if (!canAccessOrder(user, order, supplierBusiness)) return null;
  return order;
}
