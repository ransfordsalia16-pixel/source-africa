# Architecture overview

## Two services, no shared process

- `frontend/` — React 19 + Vite + react-router-dom (HashRouter, so it works on a static host with
  no server-side routing config). Talks to the backend only through `frontend/src/services/api/*`,
  which all go through the single `apiFetch` wrapper in `client.js`.
- `backend/` — Node + Express. SQLite via Node's built-in `node:sqlite` module (not
  `better-sqlite3`), and `bcryptjs`/`jsonwebtoken`/`multer`/`zod` — all pure JS, chosen specifically
  to avoid native module compilation on developer machines.

They are two independent npm projects (`frontend/package.json`, `backend/package.json`), not an
npm workspace. Run them as two separate dev servers; see the root `README.md`.

## Order state machine

`backend/src/domain/orderStateMachine.js` is the single source of truth for what state an order
can move to next and which role is allowed to trigger that move. `POST /api/orders/:id/transition`
is the *only* way an order's state changes — every transition writes an
`order_state_transitions` row and an `audit_logs` row. The frontend's 6-stage simplified view
(`order_confirmed → production → inspection → shipping → customs → delivered`) is a client-side
mapping of the backend's much finer-grained state, not a second source of truth.

## Role-based access control (RBAC)

`backend/src/middleware/rbac.js` (`requireRole`, `requirePermission`) checks the caller's role on
every `/api/admin/*` route, independent of whatever the frontend UI shows or hides. The
`role_permissions` table drives the fine-grained checks (`verification`, `payments`, `disputes`,
`settings`, `support`). Every order/dispute/conversation/case lookup by id also goes through an
IDOR check (`backend/src/domain/orderAccess.js`'s `canAccessOrder`, and the equivalent per-domain
functions) that returns 404 rather than 403 for anything the caller shouldn't be able to see, so a
non-owner can't even confirm a resource exists.

## Domain modules

`backend/src/domain/*.js` holds business logic; `backend/src/routes/*.js` is thin HTTP glue on top
of it. Each domain area follows the same shape: a `*NotFoundError`/`*AccessDeniedError` pair,
functions that take a `user` object and re-check access every time (never trusting a
previously-checked session), and a call to `recordAuditLog()` (`backend/src/audit/log.js`) on every
state-changing action.

Built so far: auth, orders (+ state machine), conversations (buyer/supplier messaging with
per-user soft-delete), disputes + evidence uploads, payments (mock provider behind a real
interface — see `docs/payments/`), and support cases (admin case management, tied to disputes and
standalone support requests).
