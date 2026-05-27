
## Pre-existing test failures (out of scope Plan 16-03)

Baseline before Plan 16-03 (stash test, on commit 6190073):
- Unit suite: 3 suites failed, 13 tests failed, 347 passed (mostly `tests/sync/pullFromServer.test.ts`).
- Integration suite: 2 suites failed (`group-lifecycle.test.ts`, `sync-pipeline.test.ts`).

Plan 16-03 did not regress these counts. New `parcela-sync.test.ts` (11 tests) all pass.

These failures are pre-existing tech debt from earlier phases (likely stale mocks from rename
in Phase 16-01) — track for a dedicated cleanup plan or Phase 17.
