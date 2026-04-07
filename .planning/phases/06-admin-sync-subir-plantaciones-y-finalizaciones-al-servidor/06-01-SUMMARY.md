---
phase: 06-admin-sync-subir-plantaciones-y-finalizaciones-al-servidor
plan: "01"
subsystem: sync-data-layer
tags: [catalog, download, sync, supabase, drizzle, tdd]
dependency_graph:
  requires:
    - mobile/src/supabase/client.ts
    - mobile/src/database/client.ts
    - mobile/src/database/schema.ts
    - mobile/src/database/liveQuery.ts
    - mobile/src/services/SyncService.ts (pullFromServer)
  provides:
    - mobile/src/queries/catalogQueries.ts (getServerCatalog, getLocalPlantationIds, ServerPlantation)
    - mobile/src/services/SyncService.ts (downloadPlantation, batchDownload, DownloadResult, DownloadProgress)
  affects:
    - Plan 06-02 (CatalogScreen consumes catalogQueries and batchDownload)
tech_stack:
  added: []
  patterns:
    - "Role-gated Supabase query: admin=org filter, tecnico=plantation_users join"
    - "Batch count fetch: subgroup rows grouped by plantation_id, trees via subgroup lookup"
    - "Upsert pattern: onConflictDoUpdate with sql`excluded.field` for updates"
    - "Single notifyDataChanged after batch loop (Phase 03 render-storm prevention pattern)"
    - "jest.resetAllMocks() in beforeEach to clear mockReturnValueOnce queues between tests"
key_files:
  created:
    - mobile/src/queries/catalogQueries.ts
    - mobile/tests/queries/catalogQueries.test.ts
    - mobile/tests/sync/downloadService.test.ts
  modified:
    - mobile/src/services/SyncService.ts
decisions:
  - "jest.resetAllMocks() used instead of jest.clearAllMocks() — clearAllMocks does NOT clear mockReturnValueOnce queues, causing inter-test leakage; resetAllMocks does"
  - "Non-jest plain objects used for Supabase chain mocks inside helpers — jest.fn() objects registered with Jest get their mockReturnValue cleared by resetAllMocks"
  - "batchDownload tests use db.insert mock directly rather than spying on downloadPlantation — ES module closures prevent spy interception of internal calls"
  - "subgroup and tree counts fetched in batch (single query each) and merged in memory — avoids N+1 queries per plantation"
metrics:
  duration: "1158s (~19min)"
  completed: "2026-04-01"
  tasks: 2
  files: 4
---

# Phase 06 Plan 01: Catalog Data Layer Summary

Catalog discovery and plantation download data layer for admin sync flow. Role-gated server queries with count enrichment, plus upsert-based download pipeline with error accumulation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create catalogQueries.ts and unit tests | 97c5b7d | mobile/src/queries/catalogQueries.ts, mobile/tests/queries/catalogQueries.test.ts |
| 2 | Add downloadPlantation and batchDownload to SyncService | 9f5a76d | mobile/src/services/SyncService.ts, mobile/tests/sync/downloadService.test.ts |

## What Was Built

### catalogQueries.ts

- `ServerPlantation` type with all plantation fields plus `subgroup_count` and `tree_count`
- `getServerCatalog(isAdmin, userId, organizacionId)`: role-gated Supabase query
  - Admin: `supabase.from('plantations').select('*').eq('organizacion_id', orgId).order(...)`
  - Tecnico: first fetches `plantation_users` for userId, returns `[]` if empty, then fetches plantations `.in('id', assignedIds)`
  - Both paths: fetches subgroup rows grouped by plantation_id, then tree rows grouped via subgroup lookup; merges counts (defaults to 0)
  - Throws on any Supabase error
- `getLocalPlantationIds()`: `db.select({ id }).from(plantations)` returning `Set<string>`

### SyncService.ts additions

- `DownloadProgress` interface: `{ total, completed, currentName }`
- `DownloadResult` type: `{ success, id, nombre }`
- `downloadPlantation(serverPlantation)`: upsert row via `db.insert(plantations).values(...).onConflictDoUpdate({ target: plantations.id, set: { estado: sql\`excluded.estado\` } })`, then `await pullFromServer(id)`
- `batchDownload(selected, onProgress?)`: loop with `onProgress` before each, try/catch per item, accumulate results; `notifyDataChanged()` ONCE after loop

## Test Coverage

- 8 tests for catalogQueries: admin path, tecnico path, no-assignment short-circuit, local ID set, count merging, 0-count defaults, error throwing
- 7 tests for downloadService: upsert shape, conflict args, per-plantation calls, progress callbacks, error accumulation, single notifyDataChanged, result shape

**Total: 15 tests, all passing**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jest.clearAllMocks() does not clear mockReturnValueOnce queues**
- **Found during:** Task 1 — repeated test failures with inter-test data leakage
- **Issue:** `jest.clearAllMocks()` only clears call history; it does NOT reset `mockReturnValueOnce` queues. Unused queued values from failing tests leaked into subsequent tests.
- **Fix:** Changed to `jest.resetAllMocks()` in `beforeEach` across both test files
- **Files modified:** mobile/tests/queries/catalogQueries.test.ts, mobile/tests/sync/downloadService.test.ts
- **Commit:** 97c5b7d, 9f5a76d

**2. [Rule 1 - Bug] jest.fn() chain helpers cleared by resetAllMocks**
- **Found during:** Task 1 — chain objects built with `jest.fn()` had `mockReturnValue(chain)` cleared between tests
- **Issue:** Plain `jest.fn()` instances created inside helper functions are registered with Jest's mock registry. `resetAllMocks` clears their implementations too.
- **Fix:** Used plain JavaScript objects with arrow function methods instead of `jest.fn()` for chain helpers
- **Files modified:** mobile/tests/queries/catalogQueries.test.ts
- **Commit:** 97c5b7d

**3. [Rule 1 - Bug] jest.spyOn cannot intercept internal module calls**
- **Found during:** Task 2 — batchDownload tests using `jest.spyOn(module, 'downloadPlantation')` had no effect
- **Issue:** ES module closures mean internal calls within the same module bypass the spy
- **Fix:** Test batchDownload by mocking the underlying `db.insert` chain (the actual mechanism), rather than spying on the higher-level function
- **Files modified:** mobile/tests/sync/downloadService.test.ts
- **Commit:** 9f5a76d

## Known Stubs

None — all functions are fully implemented with real Supabase and Drizzle calls.

## Self-Check

- [x] mobile/src/queries/catalogQueries.ts exists
- [x] mobile/src/services/SyncService.ts modified
- [x] mobile/tests/queries/catalogQueries.test.ts exists
- [x] mobile/tests/sync/downloadService.test.ts exists
- [x] Commit 97c5b7d exists (git log confirms)
- [x] Commit 9f5a76d exists (git log confirms)
- [x] All 15 tests pass

## Self-Check: PASSED
