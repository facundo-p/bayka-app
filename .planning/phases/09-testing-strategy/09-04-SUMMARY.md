---
phase: 09-testing-strategy
plan: 04
subsystem: testing
tags: [integration-tests, sqlite, drizzle, better-sqlite3]
dependency_graph:
  requires: [09-01]
  provides: [integration-test-suite]
  affects: [mobile/tests/integration/]
tech_stack:
  added: [better-sqlite3@12.8.0, @types/better-sqlite3@7.6.13]
  patterns: [integration-testing, in-memory-sqlite, drizzle-better-sqlite3]
key_files:
  created:
    - mobile/tests/helpers/integrationDb.ts
    - mobile/tests/helpers/factories.ts
    - mobile/tests/helpers/networkHelper.ts
    - mobile/tests/setup.integration.ts
    - mobile/jest.integration.config.js
    - mobile/tests/integration/subgroup-lifecycle.test.ts
    - mobile/tests/integration/sync-pipeline.test.ts
    - mobile/tests/integration/cascade-delete.test.ts
    - mobile/tests/integration/tree-registration.test.ts
    - mobile/tests/integration/role-based-access.test.ts
  modified:
    - mobile/package.json
decisions:
  - drizzle-orm/better-sqlite3 transactions are synchronous-only — async callbacks rejected with "Transaction function cannot return a promise"; use try/catch or sqlite.transaction() directly
  - better-sqlite3 FK constraints are enabled by drizzle migrator (PRAGMA foreign_keys=ON); delete order must respect FK chain: trees -> subgroups -> plantationSpecies/Users -> plantations -> species
  - rejects.toThrow() is flaky for synchronous errors in Jest parallel workers; use try/catch pattern for reliable constraint violation tests
metrics:
  duration: ~15min
  completed: 2026-04-08
  tasks_completed: 2
  files_created: 10
---

# Phase 09 Plan 04: Integration Tests for Critical Business Flows Summary

5 integration test files exercising all 4 critical paths against real in-memory SQLite with FK constraints enabled. 25 tests, 0 failures.

## Tasks Completed

### Task 1: SubGroup lifecycle, sync pipeline, cascade delete (3 files, 14 tests)

**Commit:** 9b58a0a

- `subgroup-lifecycle.test.ts`: 5 tests — activa/finalizada/sincronizada state machine, unique codigo constraint per plantation, FK reference validation
- `sync-pipeline.test.ts`: 4 tests — sequential insert atomicity, transaction rollback via sqlite.transaction(), duplicate codigo detection, sincronizada state preservation
- `cascade-delete.test.ts`: 4 tests — full cascade removal (trees/subgroups/plantation_species/plantation_users), no orphan records, empty plantation delete

Also created infrastructure:
- `integrationDb.ts` — createTestDb() / closeTestDb() using better-sqlite3 + drizzle migrator
- `factories.ts` — createTestPlantation/SubGroup/Tree/Species with random IDs
- `networkHelper.ts` — setOffline/setOnline helpers
- `setup.integration.ts` — minimal mocks for Node environment
- `jest.integration.config.js` — separate Jest config for integration tests

### Task 2: Tree registration and role-based access (2 files, 11 tests)

**Commit:** 44359d4

- `tree-registration.test.ts`: 6 tests — position auto-increment via MAX query, SubID generation (subgrupoCodigo+especieCodigo+posicion), deleteLastTree/undo cycle, N/N tree with null especieId, multi-species sequential positions, count accuracy per subgroup
- `role-based-access.test.ts`: 5 tests — admin sees all plantations (no JOIN filter), tecnico sees only plantation_users assigned plantations (INNER JOIN), cross-tecnico isolation, empty assignment edge case, admin subgroup visibility across all creators

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] drizzle-orm/better-sqlite3 transactions are synchronous-only**
- **Found during:** Task 1
- **Issue:** `db.transaction(async (tx) => { ... })` throws "Transaction function cannot return a promise" and then crashes the Node worker process with an unhandled SQLITE_CONSTRAINT error
- **Fix:** Used `sqlite.transaction()` (better-sqlite3 native sync transaction) for atomicity tests; used try/catch instead of `expect().rejects.toThrow()` for constraint violation tests
- **Files modified:** sync-pipeline.test.ts, cascade-delete.test.ts, subgroup-lifecycle.test.ts
- **Commit:** 44359d4

**2. [Rule 1 - Bug] plantation_species and user_species_order use `plantacion_id` (Spanish), plantation_users uses `plantation_id` (English)**
- **Found during:** Task 1 cascade-delete
- **Issue:** Raw SQL `DELETE FROM plantation_species WHERE plantation_id = ?` failed with "no such column: plantation_id" — the column is `plantacion_id`
- **Fix:** Used correct column names from migrations: `plantacion_id` for plantation_species and user_species_order, `plantation_id` for plantation_users
- **Files modified:** cascade-delete.test.ts
- **Commit:** 9b58a0a (fixed in same PR)

## Known Stubs

None.

## Self-Check: PASSED

- All 5 integration test files exist and confirmed present
- Both commits confirmed: 9b58a0a, 44359d4
- All 25 integration tests pass via `npx jest --config jest.integration.config.js --ci`
- 2 pre-existing unit test failures (seed.test.ts, useProfileData.test.ts) — not caused by this plan
