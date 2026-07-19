import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import "./db/connection.js"; // loads .env relative to this project before any route reads process.env
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import webhookRoutes from "./routes/webhooks.js";
import conversationRoutes from "./routes/conversations.js";
import disputeRoutes from "./routes/disputes.js";
import caseRoutes from "./routes/cases.js";
import businessApplicationRoutes from "./routes/businessApplications.js";
import productRoutes from "./routes/products.js";
import buyerVerificationRoutes from "./routes/buyerVerification.js";
import payoutAccountRoutes from "./routes/payoutAccounts.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));

// Captures the exact bytes of the request body alongside the parsed object, so webhook
// signature verification checks what was actually sent, not a re-serialized copy of it.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", paymentRoutes);
app.use("/api/webhooks", webhookLimiter, webhookRoutes);
app.use("/api", conversationRoutes);
app.use("/api", disputeRoutes);
app.use("/api", caseRoutes);
app.use("/api", businessApplicationRoutes);
app.use("/api", productRoutes);
app.use("/api", buyerVerificationRoutes);
app.use("/api", payoutAccountRoutes);

// Keep error details out of responses; log the real thing server-side. Sensitive-action
// failures still get audited by the code path that threw, not here.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side." });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`sourcebridge-server listening on http://localhost:${port}`);
});
