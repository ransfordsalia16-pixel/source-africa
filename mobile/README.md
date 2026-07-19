# Mobile app (not started yet)

This folder is reserved for a future Android/iPhone app (React Native or Expo, most likely, to
share code style and API client patterns with `frontend/`).

When work starts here, the mobile app should:
- Talk to the same `backend/` API that `frontend/` uses — no separate backend, no separate database.
- Reuse request/response shapes from `backend/src/routes/*` rather than inventing new ones.
- Read its API base URL from its own environment config, the same pattern as
  `frontend/.env` (`VITE_API_BASE_URL`) — never hardcode `http://localhost:4000` in source.

Nothing is implemented here yet.
