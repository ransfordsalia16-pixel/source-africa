## Summary

<!-- What does this change, and why? -->

## Files / systems touched

<!-- Backend routes, domain modules, schema/migrations, frontend pages, etc. -->

## Verification

<!-- There's no automated test suite yet (see tests/README.md), so describe what you
     actually checked by hand. -->

- [ ] Backend: verified the affected endpoint(s) directly (curl or a script), covering both the
      success path and the relevant error/permission cases
- [ ] Frontend: exercised the change in the browser (not just visual — clicked through the flow)
- [ ] Regression: checked that existing, unrelated flows still work (state machines, RBAC, auth)
- [ ] Schema changes: migration is idempotent (`ALTER TABLE` guarded by `PRAGMA table_info`, or
      `CREATE TABLE IF NOT EXISTS`) and safe to run against an existing database

## Screenshots

<!-- For any UI change. Delete this section if not applicable. -->

## Notes for the reviewer

<!-- Anything you're unsure about, deliberately deferred, or want a second opinion on. -->
