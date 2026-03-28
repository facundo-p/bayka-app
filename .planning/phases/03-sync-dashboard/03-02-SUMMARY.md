---
phase: 03-sync-dashboard
plan: 02
subsystem: sync
tags: [supabase, drizzle, sqlite, react-hooks, tdd, rpc]

# Dependency graph
requires:
  - phase: 03-01
    provides: sync_subgroup RPC, SubGroupRepository.markAsSincronizada, getFinalizadaSubGroups, plantation_users schema
provides:
  - SyncService.ts: syncPlantation orchestrator with pull-then-push order
  - SyncService.ts: pullFromServer (downloads subgroups/plantation_users/plantation_species)
  - SyncService.ts: uploadSubGroup (RPC call with field mapping)
  - SyncService.ts: getErrorMessage (Spanish error messages for DUPLICATE_CODE/NETWORK)
  - SyncService.ts: exported types SyncSubGroupResult, SyncProgress, SyncErrorCode
  - useSync.ts: React hook managing idle/syncing/done lifecycle state for sync UI
  - SyncService.test.ts: 8 unit tests covering all sync behaviors
affects: [03-03-dashboard-ui, sync-modal, plantation-list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Red-Green: tests written first, implementation follows"
    - "Pull-before-push: server data refreshed before any upload begins"
    - "Continue-on-failure: sync loop never breaks, accumulates all results"
    - "Single notifyDataChanged call after entire sync loop (not inside)"
    - "Field mapping layer: local camelCase to server snake_case in uploadSubGroup"

key-files:
  created:
    - mobile/src/services/SyncService.ts
    - mobile/src/hooks/useSync.ts
    - mobile/tests/sync/SyncService.test.ts
  modified: []

key-decisions:
  - "notifyDataChanged called once after the entire sync loop (not per SubGroup) to prevent render storm"
  - "useSync also calls notifyDataChanged in finally block — ensures refresh even if SyncService throws"
  - "pullFromServer silently skips empty results (no error if server returns no data)"
  - "uploadSubGroup is a pure RPC wrapper — orchestration logic lives entirely in syncPlantation"

patterns-established:
  - "SyncSubGroupResult union type: { success: true, subgroupId, nombre } | { success: false, subgroupId, nombre, error }"
  - "SyncState = 'idle' | 'syncing' | 'done' drives modal visibility in UI"
  - "Spanish error messages in ERROR_MESSAGES record — single place to update copy"

requirements-completed: [SYNC-01, SYNC-04, SYNC-05, SYNC-06]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 3 Plan 02: SyncService Summary

**Pull-then-push sync engine using Supabase RPC with per-SubGroup error accumulation, Spanish error messages, and React state hook for modal UI**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-19T13:10:00Z
- **Completed:** 2026-03-19T13:21:09Z
- **Tasks:** 2 (+ TDD RED commit)
- **Files modified:** 3

## Accomplishments
- SyncService orchestrates full pull-then-push cycle: auth refresh → pull server data → upload each finalizada SubGroup via RPC
- Error accumulation: all SubGroups attempted even on partial failure, results array captures success/failure per SubGroup
- useSync hook provides clean lifecycle state (idle/syncing/done) with progress tracking for modal UI consumption
- 8 unit tests covering pull-before-push order, RPC payload shape, markAsSincronizada gating, continue-on-failure, Spanish messages

## Task Commits

Each task was committed atomically:

1. **Task 1: SyncService with pull-then-push orchestration and unit tests** - `9c50bcc` (feat + test TDD)
2. **Task 2: useSync React hook for sync state management** - `7553e35` (feat)

**Plan metadata:** _(final docs commit)_

_Note: TDD task had tests written first (RED = module-not-found failure), then implementation (GREEN = 8/8 pass)_

## Files Created/Modified
- `mobile/src/services/SyncService.ts` (217 lines) — syncPlantation orchestrator, pullFromServer, uploadSubGroup, getErrorMessage, SyncSubGroupResult/SyncProgress/SyncErrorCode types
- `mobile/src/hooks/useSync.ts` (47 lines) — React hook with SyncState, progress tracking, startSync/reset actions, computed hasFailures/successCount/failureCount
- `mobile/tests/sync/SyncService.test.ts` (250 lines) — 8 unit tests with mocked supabase/db/repository dependencies

## Decisions Made
- `notifyDataChanged` called once after the entire sync loop in both SyncService and useSync to prevent render storms during multi-SubGroup uploads
- `useSync` calls `notifyDataChanged` in `finally` block to guarantee data refresh even if SyncService throws unexpectedly
- `pullFromServer` silently skips empty responses — no error thrown when server returns no data for a given plantation
- `uploadSubGroup` is a pure RPC wrapper with no side effects — all orchestration (markAsSincronizada, error mapping, result accumulation) lives in `syncPlantation`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TDD flow worked cleanly. Tests failed as expected in RED (module not found), all 8 passed in GREEN.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SyncService and useSync fully implemented and tested — ready for Plan 03-03 sync modal UI
- `syncPlantation(plantacionId, onProgress)` is the entry point for UI
- `useSync(plantacionId)` returns `{ state, progress, results, startSync, reset, hasFailures, successCount, failureCount }`
- All 54 tests pass (11 test suites)

---
*Phase: 03-sync-dashboard*
*Completed: 2026-03-19*
