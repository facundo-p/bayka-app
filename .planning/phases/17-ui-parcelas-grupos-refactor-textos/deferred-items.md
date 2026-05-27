# Phase 17 — Deferred Items

## 17-02 (executor)

- **Pre-existing failing test suites (out of scope, verified via `git stash`):**
  - `tests/sync/SyncPhotoFlow.test.ts`
  - `tests/sync/pullFromServer.test.ts`
  - `tests/sync/CrossDeviceSync.test.ts`
  Failures occur on the base commit (`62cc47f`) before any Plan 17-02
  changes — not caused by this plan. Tracked for a future sync-layer
  maintenance pass.
