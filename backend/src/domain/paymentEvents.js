import { db } from "../db/connection.js";
import { genId } from "../util/id.js";
import { paymentProvider } from "../payments/MockPaymentProvider.js";
import { applyTransition } from "./orderStateMachine.js";
import { recordAuditLog } from "../audit/log.js";

const getEventByIdempotencyKey = db.prepare("SELECT * FROM payment_events WHERE idempotency_key = ?");
const insertEvent = db.prepare(`
  INSERT INTO payment_events (id, payment_id, type, payload_json, signature_verified, idempotency_key)
  VALUES (@id, @payment_id, @type, @payload_json, @signature_verified, @idempotency_key)
`);
const getPaymentByProviderPaymentId = db.prepare("SELECT * FROM payments WHERE provider_payment_id = ?");
const markPaymentHeld = db.prepare("UPDATE payments SET status = 'held' WHERE id = ?");

/**
 * The one function that turns a (real or simulated) provider payment event into a confirmed,
 * secured order. Used two ways:
 *  - routes/webhooks.js calls this from an actual inbound HTTP request — the path a real
 *    provider hits asynchronously, seconds or minutes after authorize().
 *  - routes/payments.js's /orders/:id/pay calls this immediately in development, since
 *    MockPaymentProvider never actually delivers an async callback over the network the way a
 *    real provider would. Either way the event goes through the exact same signature
 *    verification and idempotency check — nothing about calling this in-process skips security,
 *    it just replaces "wait for the network" with "call the function directly."
 */
export function processPaymentWebhookEvent({ signature, rawBody, sourceIp = null }) {
  if (!rawBody || !paymentProvider.verifyWebhookSignature(rawBody, signature)) {
    recordAuditLog({
      action: "Rejected a payment webhook with an invalid or missing signature",
      targetType: "webhook",
      reason: sourceIp,
    });
    return { httpStatus: 401, body: { error: "Invalid webhook signature." } };
  }

  const payload = JSON.parse(rawBody);
  if (!payload?.idempotencyKey || !payload?.orderId || !payload?.providerPaymentId) {
    return { httpStatus: 400, body: { error: "Malformed webhook payload." } };
  }

  const existing = getEventByIdempotencyKey.get(payload.idempotencyKey);
  if (existing) {
    // Same event delivered twice (providers do this on purpose to guarantee at-least-once
    // delivery). Acknowledge it without processing it again.
    return { httpStatus: 200, body: { received: true, duplicate: true } };
  }

  const payment = getPaymentByProviderPaymentId.get(payload.providerPaymentId);

  insertEvent.run({
    id: genId("EVT"),
    payment_id: payment?.id || null,
    type: payload.type,
    payload_json: rawBody,
    signature_verified: 1,
    idempotency_key: payload.idempotencyKey,
  });

  if (payment) markPaymentHeld.run(payment.id);

  try {
    let order = applyTransition(payload.orderId, "PAYMENT_CONFIRMED", { isSystem: true, reason: "Payment webhook confirmed" });
    order = applyTransition(order.id, "PAYMENT_SECURED", { isSystem: true, reason: "Funds held by payment provider" });
    order = applyTransition(order.id, "SUPPLIER_NOTIFIED", { isSystem: true, reason: "Supplier notified the order is financially secured" });
    return { httpStatus: 200, body: { received: true, orderState: order.state } };
  } catch (err) {
    // The event and payment status are already recorded above; a state transition failure
    // (e.g. the order was already moved on by something else) should not make the provider
    // retry forever, so this still acknowledges receipt.
    return { httpStatus: 200, body: { received: true, warning: err.message } };
  }
}
