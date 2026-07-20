# SOURCE AFRICA

A B2B marketplace platform for sourcing from African and international suppliers, with buyer,
supplier, and admin dashboards, secure messaging, escrow-style payment tracking, and a dispute /
support-case system.

This is the single home for the whole project: web frontend, backend API, and database. A future
mobile app will live here too, talking to the same backend.

## Project structure

```
SOURCE AFRICA/
├── frontend/     React + Vite web app (buyer, supplier, and admin dashboards)
├── backend/      Node + Express API, SQLite database, business logic
├── mobile/       Reserved for a future Android/iPhone app — nothing built yet
├── shared/       Reserved for code shared between frontend/mobile — nothing here yet
├── docs/         architecture, security, and payments notes
├── tests/        placeholder — no automated tests exist yet, see tests/README.md
├── scripts/      PowerShell convenience scripts (install-all.ps1, start-dev.ps1)
├── .env.example  points to frontend/.env.example and backend/.env.example
└── package.json  root convenience scripts only (frontend/backend are separate npm projects)
```

`frontend/` and `backend/` are **not** an npm workspace — they're two independent projects, each
with their own `package.json` and `node_modules`. This was a deliberate choice to keep dependency
installation simple and avoid workspace-hoisting surprises. The root `package.json` just has thin
`npm --prefix` scripts so you can run either from the root if you want to.

There's no separate top-level `database/` folder. The backend owns its schema, migrations, and
seed script tightly (`backend/src/db/`) — one Express service, one SQLite file — so splitting
that out would mean adding cross-folder imports for no real benefit.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 or later (the backend uses Node's built-in `node:sqlite`
  module, available from Node 22.5+; developed and tested on Node 24)
- npm (comes with Node)

No database server to install — SQLite is a single file, created automatically.

## 1. Install dependencies

From the `SOURCE AFRICA` root:

```powershell
npm run install:all
```

This runs `npm install` inside both `frontend/` and `backend/`. Equivalent to running
`npm install` in each folder separately, or `.\scripts\install-all.ps1`.
## Quick start from the project root

Once dependencies are installed, you can use the root convenience scripts:

```powershell
npm run dev      # starts both frontend and backend in separate PowerShell windows
npm run build    # builds the frontend production bundle
npm run test     # reports that no automated tests are configured yet
```

If you prefer to start them manually, use the dedicated commands below.
## 2. Configure environment variables

Both services need their own `.env` file — copy the example and fill it in:

```powershell
Copy-Item frontend\.env.example frontend\.env
Copy-Item backend\.env.example backend\.env
```

`frontend/.env` only needs `VITE_API_BASE_URL` (defaults to `http://localhost:4000`, the backend's
default port — leave it as-is for local dev).

`backend/.env` holds real secrets for anything beyond local dev — see
[Environment variables and security](#environment-variables-and-security) below before deploying
anywhere.

**Never commit a real `.env` file.** Both are already covered by the root `.gitignore`.

## 3. Set up the local database

The database is a single SQLite file (`backend/data/sourcebridge.sqlite`), created automatically —
nothing to install or configure beyond running the migration:

```powershell
npm run migrate   # creates every table
npm run seed      # adds demo buyer, supplier, and admin accounts + sample orders
```

Run these again any time you want to reset to a clean state — `migrate` is safe to re-run
(`CREATE TABLE IF NOT EXISTS`), and `seed` uses `INSERT OR IGNORE`. To fully reset, delete
`backend/data/sourcebridge.sqlite` first, then re-run both commands — this is required whenever
`backend/src/db/schema.sql` changes (a new column or table won't retroactively apply to an
existing database file).

## 4. Start the backend

```powershell
cd backend
npm run dev
```

Starts the Express API on `http://localhost:4000` with `node --watch` (auto-restarts on file
changes). Confirm it's running: `http://localhost:4000/api/health` should return `{"ok":true}`.

## 5. Start the frontend

In a second terminal:

```powershell
cd frontend
npm run dev
```

Starts the Vite dev server on `http://localhost:5505`. Open that URL in a browser.

(Or use `.\scripts\start-dev.ps1` from the root to launch both in separate windows at once.)

## 6. Test the complete marketplace

Sign in with the seeded demo accounts (created by `npm run seed`; passwords come from
`backend/.env`'s `DEMO_*_PASSWORD` values, or these defaults if you didn't set them):

| Role | Email | Password |
|---|---|---|
| Buyer | `ama@boateng-hospitality.example` | `demo-buyer-pass` |
| Supplier | `liwei@shenzhensolar.example` | `demo-supplier-pass` |
| Admin | `kwame@sourcebridge.example` | `demo-admin-pass` |

Buyer and supplier sign in at `/#/sign-in`. **Admin sign-in is a separate page**, `/#/admin-login`
— there is no admin option on the public sign-in form, by design (see
[Security](docs/security/README.md)). These are local-dev-only credentials; change or remove them
before any shared or public deployment.

## Running tests

No automated tests exist yet — see [`tests/README.md`](tests/README.md) for what's there instead
(manual per-feature verification) and what a first test suite should target.

## How development payments work

There's no real payment provider wired in. `backend/src/payments/MockPaymentProvider.js` simulates
escrow hold, payout release, and refunds — real database rows, real order-state transitions, just
no real money. See [`docs/payments/README.md`](docs/payments/README.md) for how it works and what
swapping in a real provider (e.g. Stripe Connect) would involve later.

## How development admin access works

Admin accounts are just rows in the `users` table with an admin-tier `role_key` (`super_admin`,
`finance_admin`, `dispute_officer`, `customer_support`, etc. — see
`backend/src/db/schema.sql`'s seeded `roles`). There's no separate admin creation flow yet; new
admin accounts are added directly via the seed script or a database tool. Every `/api/admin/*`
route independently re-checks the caller's role server-side — the separate `/admin-login` page is
a UX safeguard, not the actual security boundary. Full detail in
[`docs/security/README.md`](docs/security/README.md).

## Important security information

Read [`docs/security/README.md`](docs/security/README.md) before treating any of this as
production-ready. Short version: authentication, RBAC, IDOR checks, and audit logging are real and
enforced server-side. Payments, file storage, MFA, and password reset are still local-dev
stand-ins, clearly flagged as such in the code and in that doc.

## Environment variables and security

Real secrets (`JWT_SECRET`, `WEBHOOK_SECRET`, production demo/admin passwords) belong in
`backend/.env`, which is git-ignored — never in source code, never in this README, never in
`frontend/` (anything in `frontend/.env` is `VITE_`-prefixed and gets compiled straight into the
browser bundle, i.e. is effectively public). Use `backend/.env.example` and `frontend/.env.example`
as the templates for what variables exist; they contain placeholders only.

## Deployment

### Staging environment (Vercel + Render)

A shared staging deployment tracks `master` — every push auto-redeploys both sides:

| | URL | Host |
|---|---|---|
| Frontend | https://source-africa-nwsinz75s-ransford-salia.vercel.app | Vercel |
| Backend | https://source-africa-backend.onrender.com | Render (Blueprint: `render.yaml`) |

Sign in with the same [demo accounts](#6-test-the-complete-marketplace) as local dev.

The backend's `render.yaml` runs `migrate` and `seed` on every boot rather than relying on
persistent storage — Render's free plan has no persistent disk, so the SQLite file doesn't
survive a restart anyway. Both scripts are idempotent, so this just means the staging environment
always comes back up with a clean, known demo dataset. One consequence of the free plan: the
backend spins down after ~15 minutes idle, so the first request after a gap takes 30–50s to wake
it back up.

To stand up your own copy of this staging setup:

1. **Backend on Render** — New → Blueprint → connect this repo. It auto-detects `render.yaml`.
   You'll be asked for `MFA_ENCRYPTION_KEY` (generate with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — must be exactly
   64 hex characters) since Render's auto-generated values don't guarantee that shape. Leave
   `CORS_ORIGIN` blank for now.
2. **Frontend on Vercel** — Add New → Project → import this repo, set **Root Directory** to
   `frontend`, and add environment variable `VITE_API_BASE_URL` = your Render URL from step 1.
3. Back in Render, set `CORS_ORIGIN` to your Vercel URL from step 2 and redeploy — the backend
   otherwise rejects requests from the frontend's origin.
4. By default Vercel's Deployment Protection requires a Vercel login to view any deployment,
   including production. To make the site actually public, go to Project → Settings →
   Deployment Protection → set Vercel Authentication to Disabled.

### Building for other hosts

Only the frontend has a build step — the backend runs directly with Node:

```powershell
cd frontend
npm run build
```

Outputs static files to `frontend/dist/`, servable from any static host. The backend
(`cd backend && npm start`) needs a real Node host, a persistent volume for
`backend/data/sourcebridge.sqlite` and `backend/uploads/` if you want data to survive restarts
without reseeding, and `backend/.env` populated with production values.
