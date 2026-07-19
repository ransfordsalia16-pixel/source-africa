# Security notes

## What's real, not simulated

- **Passwords**: hashed with `bcryptjs` (`backend/src/routes/auth.js`), never stored or logged in
  plaintext. Demo account passwords live only in `backend/.env` (via `DEMO_*_PASSWORD`), never in
  frontend source — `frontend/src/services/api/auth.js` has no hardcoded credentials.
- **Sessions**: JWT, verified server-side on every protected route
  (`backend/src/middleware/auth.js`). The frontend's `AuthContext` trusts nothing about a session
  except what the server returned in that JWT/response — role is never taken from which button a
  user clicked (see `SignIn.jsx` / `AdminSignIn.jsx`).
- **IDOR protection**: every by-id lookup (orders, conversations, disputes, cases) re-checks that
  the caller is actually allowed to see that specific record, and returns 404 — not 403 — when they
  aren't, so the error response doesn't confirm the record even exists.
- **Admin surface separation**: there's no public UI path to an admin session. `/admin-login` is a
  separate route from the buyer/supplier `/sign-in`, and each rejects an account of the wrong tier
  even before hitting a protected route — a UX safeguard on top of, never a substitute for, the
  server-side role checks every `/api/admin/*` route independently performs.
- **Audit logging**: `backend/src/audit/log.js`'s `recordAuditLog()` is called on every sensitive
  action — order transitions, dispute resolutions, admin reads of private conversations, case
  assignment/notes/escalation/closure. Admin access to a conversation's message content
  (`GET /api/admin/conversations/:id`) requires a real, order-matched, assigned support case, not a
  freeform "reason" string — enforced server-side, so a client that skips the check still gets
  rejected.
- **Webhook verification**: `backend/src/routes/webhooks.js` verifies an HMAC signature
  (`WEBHOOK_SECRET`) and checks an idempotency key against `payment_events` before applying
  anything — a bad signature or a replayed delivery is rejected, not silently accepted.

## What's intentionally still a stand-in (do not treat as production-ready)

- **Payments**: `backend/src/payments/MockPaymentProvider.js` simulates capture/refund. Real money
  movement needs a real, regulated payment provider (Stripe Connect or similar) and legal review —
  see `docs/payments/`.
- **File uploads**: dispute evidence is validated for type/size and stored on local disk
  (`backend/uploads/evidence/`), not cloud object storage, and isn't virus-scanned.
- **MFA**: `users.mfa_enabled` is a cosmetic flag from the schema; no real TOTP enrollment/
  verification exists.
- **Password reset / email verification**: not built.
- **Rate limiting**: `express-rate-limit` is in-process, not distributed — fine for a single dev/
  small-deployment instance, not for multiple server instances behind a load balancer.

None of the above are hidden — they're flagged here and in the relevant source files so a future
production pass has a concrete checklist instead of a false sense of completeness.
