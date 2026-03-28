---
phase: 03-sync-dashboard
plan: 03
subsystem: ui
tags: [react-native, drizzle-orm, expo, sqlite, sync, dashboard, tdd, jest]

requires:
  - phase: 03-02-sync-dashboard
    provides: useSync hook, SyncService with syncPlantation/uploadSubGroup, SyncSubGroupResult types, getErrorMessage
  - phase: 03-01-sync-dashboard
    provides: plantation_users schema table, sync_subgroup RPC, SubGroupRepository

provides:
  - usePendingSyncCount hook — live count of finalizada SubGroups (optional plantacionId filter)
  - SyncProgressModal component — syncing/done states with Spanish error messages
  - PlantacionesTabIcon with orange badge overlay showing total pending sync count
  - dashboardQueries module — getPlantationsForRole, getUnsyncedTreeCounts, getUserTotalTreeCounts, getPendingSyncCounts, getTodayTreeCounts, getTotalTreeCounts
  - PlantacionesScreen — role-gated plantation list with full dashboard stats (DASH-01 through DASH-06, SYNC-07)
  - PlantationDetailScreen — sync CTA button with Alert confirmation and SyncProgressModal

affects: [04-polish]

tech-stack:
  added: []
  patterns:
    - "Extract query functions into dedicated module (queries/) for React-free unit testability"
    - "Mock chain pattern for Drizzle ORM in Jest: self-referential chain object with terminal methods resolving to empty arrays"
    - "Role-gated queries: isAdmin controls innerJoin with plantation_users vs. direct select"
    - "SyncProgressModal driven by SyncState (idle/syncing/done) — null render on idle, full overlay on syncing/done"

key-files:
  created:
    - mobile/src/hooks/usePendingSyncCount.ts
    - mobile/src/components/SyncProgressModal.tsx
    - mobile/src/queries/dashboardQueries.ts
    - mobile/tests/sync/dashboard.test.ts
  modified:
    - mobile/src/components/PlantacionesTabIcon.tsx
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/src/screens/PlantationDetailScreen.tsx

key-decisions:
  - "dashboardQueries functions accept db from client import (not as parameter) — simpler API since mocking at module level in tests is sufficient"
  - "Mock chain pattern: groupBy and orderBy are terminal (resolve to arrays); from/innerJoin/where are intermediate (return chain) — matches Drizzle ORM chain structure"
  - "getTodayTreeCounts uses sql template with toISOString() for date comparison — consistent with existing PlantationDetailScreen approach"
  - "Sync CTA button uses colors.info (blue #1565c0) to differentiate from primary green and secondary orange — visual hierarchy preserved"
  - "usePendingSyncCount without plantacionId used by tab badge — single hook serves both global and per-plantation use cases via optional param"

patterns-established:
  - "queries/ directory: pure async query functions importable by both screens and tests"
  - "TDD mock chain for Drizzle: define intermediate vs terminal methods separately, re-initialize in beforeEach after clearAllMocks"

requirements-completed: [SYNC-07, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06]

duration: 8min
completed: 2026-03-19
---

# Phase 03 Plan 03: Sync Dashboard Summary

**Role-gated plantation dashboard with unsynced/pending stats, sync CTA with progress modal, and unit-tested dashboardQueries module covering DASH-01 through DASH-06**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-19T13:24:34Z
- **Completed:** 2026-03-19T13:32:34Z
- **Tasks:** 3 auto + 1 checkpoint (auto-approved)
- **Files modified:** 7

## Accomplishments

- Dashboard shows role-gated plantation list: admin sees all, tecnico sees only assigned (via plantation_users JOIN)
- Each plantation card shows total trees, unsynced count badge, today's count, and pending sync subgroup count
- Tab icon shows orange badge with live total pending sync count across all plantations
- PlantationDetailScreen has sync CTA button with Spanish confirmation dialog, SyncProgressModal with progress and results
- dashboardQueries module with 6 pure query functions, covered by 12 unit tests (DASH-01 through DASH-06 + SYNC-07)

## Task Commits

1. **Task 1: usePendingSyncCount hook, SyncProgressModal, PlantacionesTabIcon badge** - `f26af09` (feat)
2. **Task 2: dashboardQueries module with TDD unit tests** - `5d20441` (feat/test)
3. **Task 3: Wire dashboard queries into PlantacionesScreen + sync CTA to PlantationDetailScreen** - `a8ec9b7` (feat)
4. **Task 4: checkpoint:human-verify** - auto-approved (auto mode active)

## Files Created/Modified

- `mobile/src/hooks/usePendingSyncCount.ts` — Live finalizada SubGroup count, optional plantacionId filter
- `mobile/src/components/SyncProgressModal.tsx` — Modal overlay for syncing/done states with Spanish error messages
- `mobile/src/components/PlantacionesTabIcon.tsx` — Extended with orange badge overlay using usePendingSyncCount
- `mobile/src/queries/dashboardQueries.ts` — 6 pure query functions for role-gated list and dashboard stats
- `mobile/tests/sync/dashboard.test.ts` — 12 unit tests covering all DASH requirements
- `mobile/src/screens/PlantacionesScreen.tsx` — Replaced inline queries with dashboardQueries imports, added 3 new stat displays
- `mobile/src/screens/PlantationDetailScreen.tsx` — Added sync CTA, SyncProgressModal, Sin sincronizar stat

## Decisions Made

- `dashboardQueries` functions import `db` from the client module directly (not injected as parameter) — mocking at module level in Jest is sufficient and keeps the API simple for callers
- Mock chain pattern for Drizzle in Jest: intermediate methods (`from`, `innerJoin`, `where`) return the chain; terminal methods (`groupBy`, `orderBy`) resolve to empty arrays. Must re-initialize in `beforeEach` after `clearAllMocks` clears return values
- `getTodayTreeCounts` uses `sql` template with `toISOString()` for date comparison — consistent with existing patterns in PlantationDetailScreen
- Sync CTA uses `colors.info` (#1565c0 blue) to differentiate from primary green (normal actions) and secondary orange (pending state indicators)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed jest.mock out-of-scope variable reference**
- **Found during:** Task 2 (TDD RED phase)
- **Issue:** Initial test mock referenced `chain` variable outside `jest.mock()` factory — Jest forbids this (ReferenceError)
- **Fix:** Moved chain creation inside the mock factory function, exposed it via `db._chain` for test access
- **Verification:** All 12 tests pass
- **Committed in:** `5d20441` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Drizzle chain mock — where was incorrectly set as terminal**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Setting `chain.where.mockResolvedValue([])` made `where()` return a Promise — calling `.groupBy()` on a Promise throws TypeError
- **Fix:** Only `groupBy` and `orderBy` are terminal; `where`, `from`, `innerJoin` must return the chain
- **Verification:** All 12 tests pass including getPendingSyncCounts (where -> groupBy chain)
- **Committed in:** `5d20441` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug in test mock setup)
**Impact on plan:** Both fixes were in test infrastructure, not production code. No scope creep.

## Issues Encountered

- Drizzle ORM query chain mocking is non-trivial: Jest `clearAllMocks()` resets `mockReturnValue()` implementations, requiring explicit re-initialization in `beforeEach`. The mock chain object must be accessed via a reference stored in the mocked module (`db._chain`).

## Next Phase Readiness

- Full sync dashboard complete: role-gated list, stats per card, sync trigger UI, progress modal
- Phase 03 (Sync + Dashboard) is now complete — all 3 plans done
- Ready for Phase 04 (Polish)

---
*Phase: 03-sync-dashboard*
*Completed: 2026-03-19*
