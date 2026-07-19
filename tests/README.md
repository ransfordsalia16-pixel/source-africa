# Tests

No automated tests exist yet in `frontend/` or `backend/`. This folder is a placeholder for when
they're added, not a claim that coverage exists today.

Every feature so far has instead been verified manually per stage: direct API calls (curl /
PowerShell `Invoke-RestMethod`) against `backend/`, plus a full browser walkthrough of each role
(buyer, supplier, admin) after every change. See `docs/architecture/` for what's been built and
verified this way.

When real tests are added:
- Backend: something like `node --test` (no extra dependency needed) or `vitest`, exercising the
  route handlers in `backend/src/routes/` and the domain logic in `backend/src/domain/` directly.
- Frontend: `vitest` + `@testing-library/react` would fit the existing Vite setup with the least
  new tooling.
