---
phase: 02-field-registration
plan: "02"
subsystem: database
tags: [drizzle-orm, sqlite, expo-sqlite, expo-image-picker, expo-file-system, repositories, hooks, tdd]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Database schema (subgroups, trees, plantationSpecies), idGenerator, reverseOrder utilities, test scaffolds"

provides:
  - SubGroupRepository with createSubGroup, finalizeSubGroup, getLastSubGroupName, canEdit, useSubGroupsForPlantation
  - TreeRepository with insertTree (DB MAX position), deleteLastTree, reverseTreeOrder (transaction), resolveNNTree, updateTreePhoto
  - PlantationSpeciesRepository with getSpeciesForPlantation (joined with species, ordered by ordenVisual)
  - PhotoService with captureNNPhoto and attachTreePhoto (both copy to documentDirectory)
  - useTrees hook with unresolvedNN count derived value
  - useSubGroupsForPlantation hook (live query)
  - usePlantationSpecies hook (stable session fetch)

affects:
  - 02-03-plan (SubGroup list screen consumes useSubGroupsForPlantation, createSubGroup)
  - 02-04-plan (Tree registration screen consumes useTrees, insertTree, reverseTreeOrder, resolveNNTree, captureNNPhoto)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repository pattern: async functions in .ts files, no classes, error-type unions for results"
    - "TDD: RED test first (scaffold fails), implement, GREEN verify"
    - "Drizzle mock pattern: jest.fn() per chain method, re-wired in beforeEach for isolation"
    - "DB position reads always from MAX(posicion) — never from React state"
    - "Photo permanence: always copy from temp picker URI to documentDirectory"
    - "Transaction pattern: db.transaction() for reverseTreeOrder atomicity"

key-files:
  created:
    - mobile/src/repositories/SubGroupRepository.ts
    - mobile/src/repositories/TreeRepository.ts
    - mobile/src/repositories/PlantationSpeciesRepository.ts
    - mobile/src/services/PhotoService.ts
    - mobile/src/hooks/useSubGroups.ts
    - mobile/src/hooks/useTrees.ts
    - mobile/src/hooks/usePlantationSpecies.ts
  modified:
    - mobile/tests/database/subgroup.test.ts
    - mobile/tests/database/tree.test.ts

key-decisions:
  - "expo-image-picker 16 (SDK 52): Use MediaTypeOptions.Images not array syntax for backward compatibility"
  - "reverseTreeOrder fetches species codigo per tree inside transaction — consistent with DB state at tx time"
  - "usePlantationSpecies is NOT a live query — species are stable during a session, useState+useEffect is sufficient"

patterns-established:
  - "Pattern 1: All repository functions are exported async functions (no classes)"
  - "Pattern 2: Result unions — { success: true; id } | { success: false; error: string } for fallible ops"
  - "Pattern 3: Hooks thin-wrap useLiveQuery or getSpeciesForPlantation — no business logic in hooks"
  - "Pattern 4: N/N trees use especieCodigo='NN', especieId=null — PhotoService capture required"

requirements-completed: [SUBG-01, SUBG-02, SUBG-03, SUBG-04, SUBG-05, SUBG-06, SUBG-07, TREE-02, TREE-03, TREE-04, TREE-05, TREE-06, TREE-07, NN-01, NN-02, NN-04, NN-05, REVR-01, REVR-02, REVR-03]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 02 Plan 02: Data Layer Summary

**SubGroupRepository, TreeRepository, PlantationSpeciesRepository, PhotoService, and 3 hooks with 25 unit tests — complete data layer for field registration**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-17T21:36:49Z
- **Completed:** 2026-03-17T21:40:44Z
- **Tasks:** 2 completed
- **Files modified:** 9

## Accomplishments

- SubGroupRepository: createSubGroup (with duplicate code guard), finalizeSubGroup (blocks on unresolved N/N), getLastSubGroupName, canEdit ownership guard
- TreeRepository: insertTree always reads MAX(posicion) from DB preventing race conditions; reverseTreeOrder runs atomically in db.transaction with subId recalculation
- PhotoService: captureNNPhoto and attachTreePhoto both copy temp picker URIs to permanent documentDirectory, preventing data loss on OS memory pressure
- 25 unit tests across subgroup.test.ts and tree.test.ts — all passing, zero .todo remaining

## Task Commits

1. **Task 1: SubGroupRepository with unit tests** - `d937222` (feat)
2. **Task 2: TreeRepository, PlantationSpeciesRepository, PhotoService, and hooks** - `e941f93` (feat)

## Files Created/Modified

- `mobile/src/repositories/SubGroupRepository.ts` - SubGroup CRUD with finalizeSubGroup and ownership guard
- `mobile/src/repositories/TreeRepository.ts` - Tree operations with DB-side MAX position and transaction-based reversal
- `mobile/src/repositories/PlantationSpeciesRepository.ts` - Joined query for plantation species ordered by ordenVisual
- `mobile/src/services/PhotoService.ts` - Camera/gallery capture with permanent file copy
- `mobile/src/hooks/useSubGroups.ts` - Live query hook for subgroup list
- `mobile/src/hooks/useTrees.ts` - Live query with unresolvedNN, lastThree, totalCount derived values
- `mobile/src/hooks/usePlantationSpecies.ts` - Stable session fetch hook for species grid
- `mobile/tests/database/subgroup.test.ts` - 12 tests replacing .todo scaffolds
- `mobile/tests/database/tree.test.ts` - 13 tests replacing .todo scaffolds

## Decisions Made

- expo-image-picker 16 uses `MediaTypeOptions.Images` (not array `['images']`) for SDK 52 compatibility
- `usePlantationSpecies` uses useState+useEffect (not useLiveQuery) — species for a plantation are stable within a session
- `reverseTreeOrder` fetches species codigo per tree inside the transaction ensuring consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Full data layer ready for screen consumption
- Plans 02-03 (SubGroup list screen) and 02-04 (Tree registration screen) can import directly from repositories and hooks
- No blockers

---
*Phase: 02-field-registration*
*Completed: 2026-03-17*
