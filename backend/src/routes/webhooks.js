import { Router } from "express";
import { processPaymentWebhookEvent } from "../domain/paymentEvents.js";

const router = Router();

// This is the one endpoint in the app a real payment provider would call directly, with no
// user session attached. It is secured by signature verification and idempotency instead of
// a bearer token, exactly like a production Stripe/Adyen webhook receiver.
router.post("/payments", (req, res) => {
  const result = processPaymentWebhookEvent({
    signature: req.headers["x-sourcebridge-signature"],
    rawBody: req.rawBody,
    sourceIp: req.ip,
  });
  res.status(result.httpStatus).json(result.body);
});

export default router;
