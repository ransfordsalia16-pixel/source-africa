# Shared code (not started yet)

Reserved for code that both `frontend/` and a future `mobile/` app would otherwise duplicate —
most likely validation schemas (the backend already uses `zod` in `backend/src/routes/*`) and
TypeScript/JSDoc types for API request/response shapes.

Nothing lives here yet. `frontend/` and `backend/` do not currently import anything from this
folder — don't add a dependency on it until there's a second consumer (the future mobile app)
that actually needs the shared code, otherwise it's an abstraction with no second user.
