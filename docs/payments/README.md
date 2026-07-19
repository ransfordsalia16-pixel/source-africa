# Payments

## The mock provider

`backend/src/payments/PaymentProvider.js` defines the interface every payment provider must
implement: `authorize`, `capturePayout`, `refund`, `verifyWebhookSignature`.
`backend/src/payments/MockPaymentProvider.js` is the only implementation today — it simulates
escrow hold, payout release, and refunds without touching real money, and signs its own simulated
webhook payloads with `WEBHOOK_SECRET` (from `backend/.env`) so
`POST /api/webhooks/payments` can genuinely verify the signature and reject bad/duplicate
deliveries, the same as it would have to for a real provider.

## How money "moves" in dev

- An order's payment is authorized (mock) when it's created, held until an inspection/delivery
  milestone.
- `backend/src/domain/disputes.js`'s `resolveDispute()` calls `capturePayout()` (release to
  supplier) or `refund()` (back to buyer) depending on the outcome, and writes real rows to the
  `payments`/`payouts` tables — this isn't a status label flip, the state machine actually runs
  through `PAYOUT_PENDING` → `PAYOUT_RELEASED` → `COMPLETED` (or `REFUND_OR_REMEDY_PROCESS` →
  `COMPLETED`).

## Swapping in a real provider later

Write one new class implementing `PaymentProvider`'s interface (e.g.
`StripeConnectProvider.js`) and swap the import in `backend/src/payments/` — nothing in
`domain/` or `routes/` needs to change, since they only ever call the interface, not the mock
class directly.

**This requires a real, regulated payment provider account and legal review before going anywhere
near real transactions.** Nothing in this codebase is a substitute for that.
