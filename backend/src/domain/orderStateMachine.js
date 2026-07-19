import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { recordAuditLog } from "../audit/log.js";

// The full graph from the platform spec. Nothing outside this map is a legal transition, and
// nothing in this file trusts a request body to say what the "current" state is — it always
// reads the order's real state from the database first.
export const TRANSITIONS = {
  DRAFT: ["ORDER_CREATED"],
  ORDER_CREATED: ["PAYMENT_PENDING"],
  PAYMENT_PENDING: ["PAYMENT_CONFIRMED"],
  PAYMENT_CONFIRMED: ["PAYMENT_SECURED", "ORDER_DISPUTED"],
  PAYMENT_SECURED: ["SUPPLIER_NOTIFIED"],
  SUPPLIER_NOTIFIED: ["PRODUCTION_STARTED"],
  PRODUCTION_STARTED: ["PRODUCTION_COMPLETED"],
  PRODUCTION_COMPLETED: ["READY_FOR_SHIPMENT"],
  READY_FOR_SHIPMENT: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RECEIVED"],
  RECEIVED: ["INSPECTION_PENDING"],
  INSPECTION_PENDING: ["INSPECTION_IN_PROGRESS"],
  INSPECTION_IN_PROGRESS: ["APPROVED", "ORDER_DISPUTED"],
  APPROVED: ["PAYOUT_PENDING"],
  PAYOUT_PENDING: ["PAYOUT_RELEASED"],
  PAYOUT_RELEASED: ["COMPLETED"],
  ORDER_DISPUTED: ["EVIDENCE_COLLECTION"],
  EVIDENCE_COLLECTION: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED_FOR_PAYOUT", "REFUND_OR_REMEDY_PROCESS"],
  APPROVED_FOR_PAYOUT: ["PAYOUT_PENDING"],
  REFUND_OR_REMEDY_PROCESS: ["COMPLETED"],
  COMPLETED: [],
};

// "system" means the payment webhook route, not a logged-in user. Everything else is a real
// role from role_permissions. A transition with no entry here is not allowed for anyone.
const ROLE_RULES = {
  "DRAFT:ORDER_CREATED": ["buyer"],
  "ORDER_CREATED:PAYMENT_PENDING": ["buyer"],
  "PAYMENT_PENDING:PAYMENT_CONFIRMED": ["system"],
  "PAYMENT_CONFIRMED:PAYMENT_SECURED": ["system"],
  "PAYMENT_CONFIRMED:ORDER_DISPUTED": ["buyer", "supplier"],
  "PAYMENT_SECURED:SUPPLIER_NOTIFIED": ["system", "super_admin"],
  "SUPPLIER_NOTIFIED:PRODUCTION_STARTED": ["supplier"],
  "PRODUCTION_STARTED:PRODUCTION_COMPLETED": ["supplier"],
  "PRODUCTION_COMPLETED:READY_FOR_SHIPMENT": ["supplier"],
  "READY_FOR_SHIPMENT:SHIPPED": ["supplier"],
  "SHIPPED:DELIVERED": ["supplier", "system"],
  "DELIVERED:RECEIVED": ["buyer"],
  "RECEIVED:INSPECTION_PENDING": ["buyer", "system"],
  "INSPECTION_PENDING:INSPECTION_IN_PROGRESS": ["buyer", "super_admin"],
  "INSPECTION_IN_PROGRESS:APPROVED": ["buyer"],
  "INSPECTION_IN_PROGRESS:ORDER_DISPUTED": ["buyer"],
  "APPROVED:PAYOUT_PENDING": ["system", "super_admin", "finance_admin"],
  "PAYOUT_PENDING:PAYOUT_RELEASED": ["system", "finance_admin", "super_admin"],
  "PAYOUT_RELEASED:COMPLETED": ["system", "super_admin"],
  "ORDER_DISPUTED:EVIDENCE_COLLECTION": ["buyer", "supplier", "dispute_officer", "super_admin"],
  "EVIDENCE_COLLECTION:UNDER_REVIEW": ["dispute_officer", "super_admin"],
  "UNDER_REVIEW:APPROVED_FOR_PAYOUT": ["dispute_officer", "super_admin"],
  "UNDER_REVIEW:REFUND_OR_REMEDY_PROCESS": ["dispute_officer", "super_admin"],
  "APPROVED_FOR_PAYOUT:PAYOUT_PENDING": ["system", "super_admin", "finance_admin"],
  "REFUND_OR_REMEDY_PROCESS:COMPLETED": ["system", "finance_admin", "super_admin"],
};

export class InvalidTransitionError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}
export class ForbiddenTransitionError extends Error {
  constructor(message) {
    super(message);
    this.status = 403;
  }
}
export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
    this.status = 404;
  }
}

const getOrder = db.prepare("SELECT * FROM orders WHERE id = ?");
const updateOrderState = db.prepare("UPDATE orders SET state = ?, updated_at = datetime('now') WHERE id = ?");
const insertTransition = db.prepare(`
  INSERT INTO order_state_transitions (id, order_id, from_state, to_state, actor_user_id, reason)
  VALUES (@id, @order_id, @from_state, @to_state, @actor_user_id, @reason)
`);

/**
 * The only function in this codebase allowed to change an order's state. Every caller,
 * human or webhook, goes through here so the transition graph and role rules are enforced
 * in exactly one place.
 */
export function applyTransition(orderId, toState, { actorUserId = null, actorRole, reason = null, isSystem = false } = {}) {
  const order = getOrder.get(orderId);
  if (!order) throw new OrderNotFoundError();

  const fromState = order.state;
  const allowedNext = TRANSITIONS[fromState] || [];
  if (!allowedNext.includes(toState)) {
    throw new InvalidTransitionError(`Cannot move an order from ${fromState} to ${toState}.`);
  }

  const ruleKey = `${fromState}:${toState}`;
  const allowedRoles = ROLE_RULES[ruleKey] || [];
  const roleOk = isSystem ? allowedRoles.includes("system") : allowedRoles.includes(actorRole);
  if (!roleOk) {
    throw new ForbiddenTransitionError(`Your role cannot move an order from ${fromState} to ${toState}.`);
  }

  updateOrderState.run(toState, orderId);
  insertTransition.run({
    id: genId("TRN"),
    order_id: orderId,
    from_state: fromState,
    to_state: toState,
    actor_user_id: actorUserId,
    reason,
  });
  recordAuditLog({
    actorUserId,
    action: `Order ${orderId} moved from ${fromState} to ${toState}`,
    targetType: "order",
    targetId: orderId,
    reason,
  });

  return getOrder.get(orderId);
}

// Maps the granular backend state down to the six buyer/supplier-facing buckets the existing
// frontend already knows how to render, so Stage 1 needs no UI changes.
const UI_STAGE_MAP = {
  DRAFT: "order_confirmed",
  ORDER_CREATED: "order_confirmed",
  PAYMENT_PENDING: "order_confirmed",
  PAYMENT_CONFIRMED: "order_confirmed",
  PAYMENT_SECURED: "order_confirmed",
  SUPPLIER_NOTIFIED: "order_confirmed",
  PRODUCTION_STARTED: "production",
  PRODUCTION_COMPLETED: "production",
  READY_FOR_SHIPMENT: "production",
  SHIPPED: "shipping",
  DELIVERED: "customs",
  RECEIVED: "customs",
  INSPECTION_PENDING: "inspection",
  INSPECTION_IN_PROGRESS: "inspection",
  ORDER_DISPUTED: "inspection",
  EVIDENCE_COLLECTION: "inspection",
  UNDER_REVIEW: "inspection",
  APPROVED: "inspection",
  APPROVED_FOR_PAYOUT: "delivered",
  PAYOUT_PENDING: "delivered",
  PAYOUT_RELEASED: "delivered",
  REFUND_OR_REMEDY_PROCESS: "delivered",
  COMPLETED: "delivered",
};

export function toUiStage(state) {
  return UI_STAGE_MAP[state] || "order_confirmed";
}

export function derivePaymentStatus(state) {
  const preSecured = ["DRAFT", "ORDER_CREATED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED"];
  const released = ["PAYOUT_RELEASED", "COMPLETED"];
  if (preSecured.includes(state)) return "pending";
  if (released.includes(state)) return "released";
  return "secured";
}
