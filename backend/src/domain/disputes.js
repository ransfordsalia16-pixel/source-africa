import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { canAccessOrder, resolveSupplierBusiness, getOrderRow } from "./orderAccess.js";
import { applyTransition } from "./orderStateMachine.js";
import { recordAuditLog } from "../audit/log.js";
import { paymentProvider } from "../payments/MockPaymentProvider.js";
import { createCaseForDispute } from "./cases.js";

export class OrderAccessDeniedError extends Error {
  constructor() {
    super("Order not found.");
    this.status = 404;
  }
}
export class DisputeNotFoundError extends Error {
  constructor() {
    super("Dispute not found.");
    this.status = 404;
  }
}
export class DisputeStateError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}

const getDisputeById = db.prepare("SELECT * FROM disputes WHERE id = ?");
const insertDispute = db.prepare(`
  INSERT INTO disputes (id, order_id, opened_by_user_id, reason, description)
  VALUES (@id, @order_id, @opened_by_user_id, @reason, @description)
`);
const listForBuyer = db.prepare(`
  SELECT d.* FROM disputes d JOIN orders o ON o.id = d.order_id WHERE o.buyer_id = ? ORDER BY d.created_at DESC
`);
const listForSupplierBusiness = db.prepare(`
  SELECT d.* FROM disputes d JOIN orders o ON o.id = d.order_id WHERE o.supplier_business_id = ? ORDER BY d.created_at DESC
`);
const listAllDisputesStmt = db.prepare("SELECT * FROM disputes ORDER BY created_at DESC");
const setAssignedReviewer = db.prepare("UPDATE disputes SET assigned_reviewer_id = ? WHERE id = ?");
const setResolved = db.prepare("UPDATE disputes SET status = 'resolved', resolution = ?, resolved_at = datetime('now') WHERE id = ?");

const insertEvidence = db.prepare(`
  INSERT INTO evidence (id, dispute_id, order_id, uploaded_by_user_id, type, file_path, description)
  VALUES (@id, @dispute_id, @order_id, @uploaded_by_user_id, @type, @file_path, @description)
`);
const listEvidenceStmt = db.prepare("SELECT * FROM evidence WHERE dispute_id = ? ORDER BY created_at ASC");
const getEvidenceById = db.prepare("SELECT * FROM evidence WHERE id = ?");

const getLatestPaymentForOrder = db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1");
const markPaymentStatus = db.prepare("UPDATE payments SET status = ? WHERE id = ?");
const markPaymentRefundStatus = db.prepare("UPDATE payments SET refund_status = ? WHERE id = ?");
const insertPayout = db.prepare(`
  INSERT INTO payouts (id, order_id, supplier_business_id, amount_cents, status, released_by_user_id, released_at)
  VALUES (@id, @order_id, @supplier_business_id, @amount_cents, 'released', @released_by_user_id, datetime('now'))
`);

function requireOrderAccess(user, orderId) {
  const order = getOrderRow.get(orderId);
  if (!order) throw new OrderAccessDeniedError();
  const supplierBusiness = resolveSupplierBusiness(user, order);
  if (!canAccessOrder(user, order, supplierBusiness)) throw new OrderAccessDeniedError();
  return order;
}

export function openDispute(orderId, user, { reason, description }) {
  requireOrderAccess(user, orderId);
  if (user.role !== "buyer" && user.role !== "supplier") {
    throw new DisputeStateError("Only the buyer or supplier on an order can open a dispute.");
  }

  const dispute = {
    id: genId("DSP"),
    order_id: orderId,
    opened_by_user_id: user.id,
    reason,
    description: description || null,
  };
  insertDispute.run(dispute);

  // Both edges are already legal for buyer/supplier in orderStateMachine's ROLE_RULES — this is
  // the first caller to actually exercise them. Opening a dispute immediately puts the order
  // into evidence collection, matching the spec's flow.
  applyTransition(orderId, "ORDER_DISPUTED", { actorUserId: user.id, actorRole: user.role, reason });
  const order = applyTransition(orderId, "EVIDENCE_COLLECTION", {
    actorUserId: user.id,
    actorRole: user.role,
    reason: "Dispute opened, collecting evidence",
  });

  recordAuditLog({
    actorUserId: user.id,
    action: `Opened a dispute on order ${orderId}: ${reason}`,
    targetType: "dispute",
    targetId: dispute.id,
  });

  // Every dispute is trackable as a case from the moment it's opened.
  createCaseForDispute(dispute, order);

  return { dispute: getDisputeById.get(dispute.id), order };
}

export function listDisputesForUser(user) {
  if (user.role === "buyer") return listForBuyer.all(user.id);
  if (user.role === "supplier") {
    const business = resolveSupplierBusiness(user, null);
    return business ? listForSupplierBusiness.all(business.id) : [];
  }
  return [];
}

export function listAllDisputes() {
  return listAllDisputesStmt.all();
}

export function getDisputeIfAccessible(user, disputeId) {
  const dispute = getDisputeById.get(disputeId);
  if (!dispute) throw new DisputeNotFoundError();
  const order = getOrderRow.get(dispute.order_id);
  const supplierBusiness = resolveSupplierBusiness(user, order);
  if (!canAccessOrder(user, order, supplierBusiness)) throw new DisputeNotFoundError();
  return { dispute, order };
}

export function listEvidence(disputeId) {
  return listEvidenceStmt.all(disputeId);
}

export function addEvidence(disputeId, user, { type, description, filePath }) {
  const { dispute } = getDisputeIfAccessible(user, disputeId);
  const evidence = {
    id: genId("EVD"),
    dispute_id: disputeId,
    order_id: dispute.order_id,
    uploaded_by_user_id: user.id,
    type: type || "document",
    file_path: filePath,
    description: description || null,
  };
  insertEvidence.run(evidence);
  recordAuditLog({
    actorUserId: user.id,
    action: `Uploaded evidence to dispute ${disputeId}`,
    targetType: "evidence",
    targetId: evidence.id,
  });
  return getEvidenceById.get(evidence.id);
}

export function getEvidenceIfAccessible(user, disputeId, evidenceId) {
  getDisputeIfAccessible(user, disputeId);
  const evidence = getEvidenceById.get(evidenceId);
  if (!evidence || evidence.dispute_id !== disputeId) throw new DisputeNotFoundError();
  return evidence;
}

export function assignReviewer(disputeId, adminUser) {
  const dispute = getDisputeById.get(disputeId);
  if (!dispute) throw new DisputeNotFoundError();

  setAssignedReviewer.run(adminUser.id, disputeId);

  let order = getOrderRow.get(dispute.order_id);
  if (order.state === "EVIDENCE_COLLECTION") {
    order = applyTransition(dispute.order_id, "UNDER_REVIEW", {
      actorUserId: adminUser.id,
      actorRole: adminUser.role,
      reason: "Reviewer assigned",
    });
  }

  recordAuditLog({
    actorUserId: adminUser.id,
    action: `Took dispute ${disputeId} for review`,
    targetType: "dispute",
    targetId: disputeId,
  });

  return { dispute: getDisputeById.get(disputeId), order };
}

// The role check that a real human decided the outcome (dispute_officer / super_admin) happens
// on the UNDER_REVIEW -> APPROVED_FOR_PAYOUT / REFUND_OR_REMEDY_PROCESS edge, using the admin's
// real role. Everything after that — actually moving the order through PAYOUT_PENDING,
// PAYOUT_RELEASED, COMPLETED — is the automatic consequence of that one decision, not a second
// human authorization, so those edges run with isSystem: true (the same allowance the payment
// webhook uses), while still recording the admin as the actor for audit purposes. This avoids
// loosening the payout role rules Stage 1 already tested, instead of requiring a dispute officer
// to also somehow hold finance_admin's role just to finish resolving their own case.
export function resolveDispute(disputeId, adminUser, { outcome, resolution }) {
  const dispute = getDisputeById.get(disputeId);
  if (!dispute) throw new DisputeNotFoundError();
  if (dispute.status === "resolved") {
    throw new DisputeStateError("This dispute has already been resolved.");
  }
  if (outcome !== "supplier" && outcome !== "buyer") {
    throw new DisputeStateError("outcome must be 'supplier' or 'buyer'.");
  }

  const order = getOrderRow.get(dispute.order_id);
  const payment = getLatestPaymentForOrder.get(dispute.order_id);

  if (order.state === "EVIDENCE_COLLECTION") {
    applyTransition(dispute.order_id, "UNDER_REVIEW", {
      actorUserId: adminUser.id,
      actorRole: adminUser.role,
      reason: "Reviewing evidence",
    });
  }

  let updatedOrder;
  if (outcome === "supplier") {
    applyTransition(dispute.order_id, "APPROVED_FOR_PAYOUT", { actorUserId: adminUser.id, actorRole: adminUser.role, reason: resolution });
    applyTransition(dispute.order_id, "PAYOUT_PENDING", { actorUserId: adminUser.id, isSystem: true, reason: "Automatic consequence of dispute resolution" });

    paymentProvider.capturePayout(order.id, order.value_cents);
    if (payment) markPaymentStatus.run("released", payment.id);
    insertPayout.run({
      id: genId("PAYOUT"),
      order_id: order.id,
      supplier_business_id: order.supplier_business_id,
      amount_cents: order.value_cents,
      released_by_user_id: adminUser.id,
    });

    applyTransition(dispute.order_id, "PAYOUT_RELEASED", { actorUserId: adminUser.id, isSystem: true, reason: "Funds released to supplier" });
    updatedOrder = applyTransition(dispute.order_id, "COMPLETED", { actorUserId: adminUser.id, isSystem: true, reason: "Dispute resolved in the supplier's favor" });
  } else {
    applyTransition(dispute.order_id, "REFUND_OR_REMEDY_PROCESS", { actorUserId: adminUser.id, actorRole: adminUser.role, reason: resolution });

    paymentProvider.refund(order.id, order.value_cents);
    if (payment) {
      markPaymentStatus.run("refunded", payment.id);
      markPaymentRefundStatus.run("refunded", payment.id);
    }

    updatedOrder = applyTransition(dispute.order_id, "COMPLETED", { actorUserId: adminUser.id, isSystem: true, reason: "Dispute resolved in the buyer's favor" });
  }

  setResolved.run(resolution, disputeId);
  recordAuditLog({
    actorUserId: adminUser.id,
    action: `Resolved dispute ${disputeId} in favor of the ${outcome}`,
    targetType: "dispute",
    targetId: disputeId,
    reason: resolution,
  });

  return { dispute: getDisputeById.get(disputeId), order: updatedOrder };
}
