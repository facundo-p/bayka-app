---
phase: "09-testing-strategy"
plan: "03"
subsystem: "mobile/screens-hooks"
tags: ["refactor", "hooks", "claude-md-compliance", "screen-decomposition"]
dependency_graph:
  requires: ["09-02"]
  provides: ["clean-screen-layer", "testable-hooks"]
  affects: ["mobile/src/screens/*", "mobile/src/hooks/*"]
tech_stack:
  added: []
  patterns: ["hook-extraction", "thin-screen-orchestrator", "zero-import-violation"]
key_files:
  created:
    - mobile/src/hooks/usePlantationAdmin.ts
    - mobile/src/hooks/usePlantationDetail.ts
    - mobile/src/hooks/useSpeciesConfig.ts
    - mobile/src/hooks/useCatalog.ts
    - mobile/src/hooks/useNNResolution.ts
    - mobile/src/hooks/useAssignTechnicians.ts
    - mobile/src/hooks/useNewSubgroup.ts
    - mobile/src/hooks/usePlantaciones.ts
    - mobile/src/components/AdminPlantationModals.tsx
    - mobile/src/components/PlantationDetailHeader.tsx
  modified:
    - mobile/src/screens/AdminScreen.tsx
    - mobile/src/screens/PlantationDetailScreen.tsx
    - mobile/src/screens/ConfigureSpeciesScreen.tsx
    - mobile/src/screens/CatalogScreen.tsx
    - mobile/src/screens/NNResolutionScreen.tsx
    - mobile/src/screens/AssignTechniciansScreen.tsx
    - mobile/src/screens/NuevoSubgrupoScreen.tsx
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/src/queries/adminQueries.ts
decisions:
  - "Extracted AdminPlantationModals and PlantationDetailHeader components to bring AdminScreen and PlantationDetailScreen below line limits after initial hook extraction was insufficient"
  - "Added getAllSpecies() to adminQueries.ts to give ConfigureSpeciesScreen a path to species data without importing db directly"
  - "Re-exported SubGroup and SubGroupTipo types from usePlantationDetail.ts so screen never needs a type import from repositories/"
metrics:
  duration: "~90 minutes"
  completed: "2026-04-09"
  tasks: 2
  files: 19
---

# Phase 09 Plan 03: Screen Layer CLAUDE.md Compliance — Hook Extraction Summary

All 8 screens now comply with CLAUDE.md Rule 9 (zero direct imports from repositories/, queries/, services/, database/). 8 hooks and 2 components were extracted. Critical db-import violation in ConfigureSpeciesScreen is resolved.

## Tasks Completed

### Task 1: Extract hooks for AdminScreen, PlantationDetailScreen, ConfigureSpeciesScreen

**AdminScreen.tsx**: 913 lines → 333 lines
- Extracted `usePlantationAdmin.ts` (all CRUD, finalization, ID generation, export, confirm logic)
- Extracted `AdminPlantationModals.tsx` (create/edit modals, confirm modal, seed dialog, export overlay, species config modal, assign technicians modal) — needed to bring screen under 350 lines

**PlantationDetailScreen.tsx**: 607 lines → 199 lines
- Extracted `usePlantationDetail.ts` (subgroup rows, NN counts, tree counts, user names, delete/edit handlers)
- Extracted `PlantationDetailHeader.tsx` (pull button, sync button, NN banner, finalization banner, filter cards) — needed to bring screen under 300 lines

**ConfigureSpeciesScreen.tsx**: critical violation fixed → 171 lines
- Had direct `db.select().from(speciesTable)` — Rule 9 violation
- Added `getAllSpecies()` to `mobile/src/queries/adminQueries.ts`
- Extracted `useSpeciesConfig.ts` (species toggle, select all, save logic)

**Commit**: `4463c76`

### Task 2: Extract hooks for CatalogScreen, NNResolutionScreen, AssignTechniciansScreen, NuevoSubgrupoScreen, PlantacionesScreen

**CatalogScreen.tsx**: 329 lines → 143 lines
- Extracted `useCatalog.ts` (catalog load, selection, batch download, local plantation deletion with unsynced checks)

**NNResolutionScreen.tsx**: 414 lines → 179 lines
- Extracted `useNNResolution.ts` (single subgroup + plantation-wide NN loading, species selection, resolution commit)

**AssignTechniciansScreen.tsx**: 387 lines → 154 lines
- Extracted `useAssignTechnicians.ts` (org technician list from Supabase, assigned techs from SQLite, toggle with unsynced warning, save)

**NuevoSubgrupoScreen.tsx**: 79 lines → 51 lines
- Extracted `useNewSubgroup.ts` (last subgroup name query, subgroup creation)

**PlantacionesScreen.tsx**: 253 lines → 129 lines
- Extracted `usePlantaciones.ts` (plantation list, tree stats maps, freshness banner, pull-from-server logic)

**Commit**: `f2b06cd`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing abstraction] getAllSpecies() needed in adminQueries.ts**
- **Found during:** Task 1 — ConfigureSpeciesScreen
- **Issue:** No existing query function for fetching all species. ConfigureSpeciesScreen had raw `db.select().from(speciesTable)` — the only path to fix it.
- **Fix:** Added `getAllSpecies()` to `mobile/src/queries/adminQueries.ts` with `asc(species.nombre)` ordering. Added `asc` to drizzle-orm imports.
- **Files modified:** `mobile/src/queries/adminQueries.ts`
- **Commit:** `4463c76`

**2. [Rule 2 - Type re-export] SubGroup/SubGroupTipo type imports from repositories in screen**
- **Found during:** Task 1 — PlantationDetailScreen
- **Issue:** Screen needed `SubGroup` and `SubGroupTipo` types from SubGroupRepository, which would be a Rule 9 violation.
- **Fix:** Re-exported both types from `usePlantationDetail.ts`. Screen imports from the hook, not the repository.
- **Files modified:** `mobile/src/hooks/usePlantationDetail.ts`, `mobile/src/screens/PlantationDetailScreen.tsx`
- **Commit:** `4463c76`

**3. [Rule 1 - Bug] borderRadius.round does not exist in theme**
- **Found during:** Task 1 — AdminScreen style extraction
- **Issue:** Styles used `borderRadius.round` (value: 20) for circular buttons, but the correct theme token for full circles is `borderRadius.full` (9999).
- **Fix:** Updated two style entries in AdminScreen.tsx to use `borderRadius.full`.
- **Files modified:** `mobile/src/screens/AdminScreen.tsx`
- **Commit:** `4463c76`

## Known Stubs

None — all screens wire real data through extracted hooks.

## Deferred Items

**TreeRegistrationScreen** (`mobile/src/screens/TreeRegistrationScreen.tsx`) still imports directly from repositories/, services/, and database/. This was supposed to be addressed in plan 09-02 but was not completed. Out of scope for 09-03 (not in `files_modified` list). Documented in `mobile/.planning/debug/` if it exists, otherwise tracked here.

## Test Results

- 26 test suites pass
- 2 pre-existing failures: `seed.test.ts`, `useProfileData.test.ts` — both verified pre-existing before any changes in this plan (via git stash). No regressions introduced.

## Final Screen Line Counts

| Screen | Before | After | Target |
| --- | --- | --- | --- |
| AdminScreen.tsx | 913 | 333 | <350 |
| PlantationDetailScreen.tsx | 607 | 199 | <300 |
| ConfigureSpeciesScreen.tsx | ~300 | 171 | - |
| CatalogScreen.tsx | 329 | 143 | - |
| NNResolutionScreen.tsx | 414 | 179 | - |
| AssignTechniciansScreen.tsx | 387 | 154 | - |
| NuevoSubgrupoScreen.tsx | 79 | 51 | - |
| PlantacionesScreen.tsx | 253 | 129 | - |

## Self-Check: PASSED

All 8 hook files confirmed present. Both task commits confirmed in git log.
