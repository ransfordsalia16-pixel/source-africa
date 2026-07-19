# Safe migration plan for SOURCE AFRICA

## Current status

The marketplace project is already rooted at the requested workspace folder:

- C:\Users\User\Desktop\SOURCE AFRICA

No destructive moves or deletions were required. The frontend, backend, docs, scripts, tests,
and mobile placeholder are already organized under this root.

## Safety principles

1. Preserve the existing frontend and backend work in place.
2. Keep the root folder as the single source of truth.
3. Prefer relative paths and existing package scripts over hard-coded absolute paths.
4. Avoid duplicate project copies; if a new location is needed, copy only after verification.

## Verified structure

- Frontend: frontend/
- Backend: backend/
- Database + migrations: backend/src/db/ and backend/data/
- Docs: docs/
- Scripts: scripts/
- Tests: tests/
- Future mobile app: mobile/

## Verification checklist

- Frontend dependencies installed successfully.
- Frontend production build succeeds.
- Backend migrations run successfully.
- Backend seed data creates demo accounts successfully.
- Root convenience commands are available through package.json.

## Next steps

- Use npm run dev from the project root when starting the full stack locally.
- Use npm run build for the frontend production build.
- Keep any future mobile work inside mobile/ and connect it to the existing backend API.
