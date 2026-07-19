import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";
import { getBusinessById } from "./orderAccess.js";

export class SupplierNotVerifiedError extends Error {
  constructor() {
    super("You can only order from a verified supplier.");
    this.status = 403;
  }
}
export class SupplierNotFoundError extends Error {
  constructor() {
    super("Supplier not found.");
    this.status = 404;
  }
}

// One order, one number here for now — not a scoring model, just a plain documented threshold
// so the decision is explainable. 'custom' isn't auto-selected yet: nothing on a product marks
// it as made-to-order, so that path stays available for later without being reachable here.
const HIGH_VALUE_THRESHOLD_CENTS = 500000; // $5,000

function computeProtectionModel(valueCents) {
  return valueCents >= HIGH_VALUE_THRESHOLD_CENTS ? "high_value" : "standard";
}

const insertOrder = db.prepare(`
  INSERT INTO orders (id, buyer_id, supplier_business_id, product_summary, currency, value_cents, state, protection_model, version)
  VALUES (@id, @buyer_id, @supplier_business_id, @product_summary, @currency, @value_cents, 'DRAFT', @protection_model, 1)
`);
const insertOrderVersion = db.prepare(`
  INSERT INTO order_versions (id, order_id, version_number, product_summary, value_cents, currency)
  VALUES (@id, @order_id, 1, @product_summary, @value_cents, @currency)
`);
const getOrderById = db.prepare("SELECT * FROM orders WHERE id = ?");

// The only place a new order gets created. Buyers can only order from a business that has
// actually cleared review — this is the one enforcement point that makes "verified supplier"
// mean something to a buyer, not just a badge on a profile page.
export function createOrder(buyer, { supplierBusinessId, productSummary, valueCents, currency }) {
  const business = getBusinessById.get(supplierBusinessId);
  if (!business) throw new SupplierNotFoundError();
  if (business.verification_status !== "SUPPLIER_VERIFIED") throw new SupplierNotVerifiedError();

  const order = {
    id: genId("ORD"),
    buyer_id: buyer.id,
    supplier_business_id: supplierBusinessId,
    product_summary: productSummary,
    currency,
    value_cents: valueCents,
    protection_model: computeProtectionModel(valueCents),
  };
  insertOrder.run(order);
  insertOrderVersion.run({ id: genId("ORDV"), order_id: order.id, product_summary: productSummary, value_cents: valueCents, currency });

  recordAuditLog({
    actorUserId: buyer.id,
    action: `Created order ${order.id} (${order.protection_model} protection) with business ${supplierBusinessId}`,
    targetType: "order",
    targetId: order.id,
  });

  return getOrderById.get(order.id);
}

export function getLatestOrderVersion(orderId) {
  return db.prepare("SELECT * FROM order_versions WHERE order_id = ? ORDER BY version_number DESC LIMIT 1").get(orderId);
}
