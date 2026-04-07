---
phase: 07-eliminar-plantacion-local
plan: 01
subsystem: database
tags: [drizzle-orm, sqlite, cascade-delete, transaction]

# Dependency graph
requires:
  - phase: 06-admin-sync
    provides: catalog queries and plantation download infrastructure
provides:
  - deletePlantationLocally function for cascade delete of all 6 tables
  - getUnsyncedSubgroupSummary function for unsynced detection before delete
affects: [07-02 UI layer for delete plantation]

# Tech tracking
tech-stack:
  added: []
  patterns: [transactional cascade delete, unsynced state aggregation query]

key-files:
  created:
    - mobile/tests/repositories/deletePlantationLocally.test.ts
    - mobile/tests/queries/unsyncedSubgroupSummary.test.ts
  modified:
    - mobile/src/repositories/PlantationRepository.ts
    - mobile/src/queries/catalogQueries.ts

key-decisions:
  - "deletePlantationLocally uses IN subquery for trees (via subgroup IDs) rather than fetching IDs first — single SQL statement"
  - "getUnsyncedSubgroupSummary does NOT filter by usuarioCreador — counts ALL subgroups regardless of technician (per research Pitfall 4)"

patterns-established:
  - "Cascade delete pattern: delete children before parents in transaction, notifyDataChanged after commit"
  - "State aggregation query: GROUP BY estado with count() and null-safe defaults via ?? 0"

requirements-completed: [DEL-01-cascade-delete, DEL-02-unsynced-detection]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 07 Plan 01: Delete Plantation Data Layer Summary

**Transactional cascade delete of 6 SQLite tables and unsynced subgroup detection query for confirmation dialog logic**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T04:16:14Z
- **Completed:** 2026-04-06T04:19:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- deletePlantationLocally atomically removes plantation + subgroups + trees + plantation_species + plantation_users + user_species_order in a single transaction
- getUnsyncedSubgroupSummary returns activa/finalizada counts for pre-delete confirmation dialog
- 12 unit tests covering cascade order, atomicity, rollback, mixed states, empty plantations, and no-user-filter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deletePlantationLocally to PlantationRepository** - `efd7f91` (feat)
2. **Task 2: Add getUnsyncedSubgroupSummary to catalogQueries** - `c347e67` (feat)

## Files Created/Modified
- `mobile/src/repositories/PlantationRepository.ts` - Added deletePlantationLocally cascade delete function and imported 3 additional table schemas
- `mobile/src/queries/catalogQueries.ts` - Added getUnsyncedSubgroupSummary with UnsyncedSummary type, imported subgroups schema and drizzle operators
- `mobile/tests/repositories/deletePlantationLocally.test.ts` - 8 tests for cascade delete: table coverage, order, atomicity, rollback
- `mobile/tests/queries/unsyncedSubgroupSummary.test.ts` - 4 tests for unsynced detection: mixed states, all-synced, empty, no-user-filter

## Decisions Made
- deletePlantationLocally uses IN subquery for trees (via subgroup IDs) rather than fetching IDs first — single SQL statement per the plan
- getUnsyncedSubgroupSummary does NOT filter by usuarioCreador — counts ALL subgroups regardless of technician (per research Pitfall 4)
- Tests placed in mobile/tests/ directory (not src/__tests__/) following existing project convention

## Deviations from Plan

### Test file location adjusted

Plan specified `src/repositories/__tests__/` and `src/queries/__tests__/` but project convention places tests in `mobile/tests/` directory. Adjusted to match existing pattern. This is a Rule 3 (blocking) auto-fix.

---

**Total deviations:** 1 auto-fixed (test file location)
**Impact on plan:** Minor path adjustment, no functional impact.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - both functions are fully implemented with no placeholder data.

## Next Phase Readiness
- Both functions exported and ready for Plan 02 (UI layer)
- deletePlantationLocally can be called from a confirmation dialog handler
- getUnsyncedSubgroupSummary provides the data for choosing simple vs double confirmation

---
*Phase: 07-eliminar-plantacion-local*
*Completed: 2026-04-06*
