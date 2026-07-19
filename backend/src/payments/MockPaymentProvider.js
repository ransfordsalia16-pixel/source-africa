import crypto from "node:crypto";
import { PaymentProvider } from "./PaymentProvider.js";

// Stands in for a regulated payment provider so the rest of the app can be built and tested
// against a real interface. It genuinely signs and verifies webhook payloads with HMAC-SHA256
// and genuinely rejects a bad signature; what it does NOT do is move real money, because that
// requires the platform owner's own provider account, KYC, and legal review. This is the single
// file that gets replaced (with a StripeConnectProvider or similar) when that's in place.
export class MockPaymentProvider extends PaymentProvider {
  #secret() {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) throw new Error("WEBHOOK_SECRET is not configured.");
    return secret;
  }

  sign(rawBody) {
    return crypto.createHmac("sha256", this.#secret()).update(rawBody).digest("hex");
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const expected = this.sign(rawBody);
    const expectedBuf = Buffer.from(expected, "hex");
    const gotBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== gotBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, gotBuf);
  }

  // In a real integration this returns immediately with a client-side confirmation token and
  // the provider calls our webhook asynchronously, seconds or minutes later. Here we build
  // that future webhook call up front and hand it back to the caller so the round trip can be
  // exercised without a real external provider. routes/payments.js is explicit that this is a
  // demo convenience, not something a production client should ever see.
  authorize(orderId, amountCents) {
    const providerPaymentId = `mock_pay_${crypto.randomUUID()}`;
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      type: "payment.confirmed",
      orderId,
      amountCents,
      providerPaymentId,
      idempotencyKey,
    };
    const rawBody = JSON.stringify(payload);
    return {
      providerPaymentId,
      idempotencyKey,
      webhookPayload: payload,
      webhookRawBody: rawBody,
      webhookSignature: this.sign(rawBody),
    };
  }

  capturePayout(_orderId, _amountCents) {
    return { payoutId: `mock_payout_${crypto.randomUUID()}`, status: "released" };
  }

  refund(_orderId, _amountCents) {
    return { refundId: `mock_refund_${crypto.randomUUID()}`, status: "refunded" };
  }
}

export const paymentProvider = new MockPaymentProvider();
