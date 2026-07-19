// The interface a real regulated payment provider (Stripe Connect, Adyen for Platforms, etc.)
// would implement. Swapping providers later means writing one new class that implements this
// same shape and pointing routes/payments.js and routes/webhooks.js at it, nothing else in
// the app needs to change.
export class PaymentProvider {
  // Places a hold for amountCents against orderId. Returns provider references and whatever
  // the provider needs the caller to know about pending confirmation.
  authorize(_orderId, _amountCents) {
    throw new Error("authorize() not implemented");
  }

  // Releases held funds to the supplier once an order reaches APPROVED / PAYOUT_PENDING.
  capturePayout(_orderId, _amountCents) {
    throw new Error("capturePayout() not implemented");
  }

  // Returns held or already-captured funds to the buyer.
  refund(_orderId, _amountCents) {
    throw new Error("refund() not implemented");
  }

  // Verifies that a webhook body genuinely came from the provider, not from anyone who can
  // guess the endpoint URL.
  verifyWebhookSignature(_rawBody, _signature) {
    throw new Error("verifyWebhookSignature() not implemented");
  }
}
