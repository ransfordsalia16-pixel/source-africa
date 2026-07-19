import { Router } from "express";
import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { applyTransition, InvalidTransitionError, ForbiddenTransitionError } from "../domain/orderStateMachine.js";
import { getLatestOrderVersion } from "../domain/orders.js";
import { getBusinessOwnedBy } from "../domain/orderAccess.js";
import { paymentProvider } from "../payments/MockPaymentProvider.js";
import { processPaymentWebhookEvent } from "../domain/paymentEvents.js";

const router = Router();

// Placeholder platform fee, clearly a stand-in pending the real fee model that comes with the
// production payment provider decision — not meant to be read as a finalized business term.
const PLATFORM_FEE_BPS = 500; // 5.00%

const getOrder = db.prepare("SELECT * FROM orders WHERE id = ?");
const insertPayment = db.prepare(`
  INSERT INTO payments (id, order_id, buyer_id, supplier_business_id, order_version_id, provider, provider_payment_id, amount_cents, platform_fee_cents, currency, status, idempotency_key)
  VALUES (@id, @order_id, @buyer_id, @supplier_business_id, @order_version_id, @provider, @provider_payment_id, @amount_cents, @platform_fee_cents, @currency, @status, @idempotency_key)
`);
const getPaymentsForBuyer = db.prepare("SELECT * FROM payments WHERE buyer_id = ? ORDER BY created_at DESC");
const getPaymentsForSupplierBusiness = db.prepare("SELECT * FROM payments WHERE supplier_business_id = ? ORDER BY created_at DESC");
const getAllPayments = db.prepare("SELECT * FROM payments ORDER BY created_at DESC");

function serializePayment(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    buyerId: row.buyer_id,
    supplierBusinessId: row.supplier_business_id,
    orderVersionId: row.order_version_id,
    provider: row.provider,
    amount: row.amount_cents / 100,
    platformFee: row.platform_fee_cents / 100,
    currency: row.currency,
    status: row.status,
    refundStatus: row.refund_status,
    createdAt: row.created_at,
  };
}

// Buyer-initiated: "pay for this order through the official platform payment flow."
// This does not move money. It puts the order into PAYMENT_PENDING, then — because
// MockPaymentProvider never actually delivers an async callback over the network the way a real
// provider would — immediately feeds the resulting event through the exact same signature-
// verified, idempotent path routes/webhooks.js exposes to the outside world (see
// domain/paymentEvents.js). That's what lets the development flow show the complete lifecycle
// (payment confirmed -> secured -> supplier notified) without a manual second call. A production
// client would never see webhookRawBody/webhookSignature directly — see the comment on
// MockPaymentProvider.authorize().
router.post("/orders/:id/pay", requireAuth, (req, res) => {
  if (req.user.role !== "buyer") {
    return res.status(403).json({ error: "Only the buyer on an order can pay for it." });
  }
  const order = getOrder.get(req.params.id);
  if (!order || order.buyer_id !== req.user.id) {
    return res.status(404).json({ error: "Order not found." });
  }

  const PAYABLE_STATES = ["DRAFT", "ORDER_CREATED", "PAYMENT_PENDING"];
  if (!PAYABLE_STATES.includes(order.state)) {
    return res.status(409).json({ error: `This order is already past payment (currently ${order.state}) and cannot be paid again.` });
  }

  try {
    let current = order;
    if (current.state === "DRAFT") {
      current = applyTransition(current.id, "ORDER_CREATED", { actorUserId: req.user.id, actorRole: req.user.role });
    }
    if (current.state === "ORDER_CREATED") {
      current = applyTransition(current.id, "PAYMENT_PENDING", { actorUserId: req.user.id, actorRole: req.user.role });
    }

    const authResult = paymentProvider.authorize(order.id, order.value_cents);
    const orderVersion = getLatestOrderVersion(order.id);
    insertPayment.run({
      id: genId("PAY"),
      order_id: order.id,
      buyer_id: order.buyer_id,
      supplier_business_id: order.supplier_business_id,
      order_version_id: orderVersion?.id ?? null,
      provider: "mock",
      provider_payment_id: authResult.providerPaymentId,
      amount_cents: order.value_cents,
      platform_fee_cents: Math.round((order.value_cents * PLATFORM_FEE_BPS) / 10000),
      currency: order.currency,
      status: "pending",
      idempotency_key: authResult.idempotencyKey,
    });

    // Simulates the provider's async callback happening immediately instead of over the
    // network — see the comment above. Still goes through full signature verification and
    // idempotency; nothing here is a shortcut around that check.
    const webhookResult = processPaymentWebhookEvent({
      signature: authResult.webhookSignature,
      rawBody: authResult.webhookRawBody,
    });
    const finalOrder = getOrder.get(order.id);

    res.json({
      order: finalOrder,
      demoOnly_webhookSimulation: {
        note: "In a real integration the provider sends this to POST /api/webhooks/payments on its own, asynchronously. In development it was just processed immediately (see above) — this is included only so the same round trip can also be exercised manually if needed.",
        url: "/api/webhooks/payments",
        headers: { "x-sourcebridge-signature": authResult.webhookSignature },
        body: authResult.webhookPayload,
        result: webhookResult.body,
      },
    });
  } catch (err) {
    if (err instanceof InvalidTransitionError || err instanceof ForbiddenTransitionError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
});

router.get("/payments/mine", requireAuth, (req, res) => {
  if (req.user.role === "buyer") {
    return res.json(getPaymentsForBuyer.all(req.user.id).map(serializePayment));
  }
  if (req.user.role === "supplier") {
    const business = getBusinessOwnedBy.get(req.user.id);
    return res.json(business ? getPaymentsForSupplierBusiness.all(business.id).map(serializePayment) : []);
  }
  res.json([]);
});

router.get("/admin/payments", requireAuth, requirePermission("payments"), (req, res) => {
  res.json(getAllPayments.all().map(serializePayment));
});

export default router;
