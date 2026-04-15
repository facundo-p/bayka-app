---
phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
plan: 02
subsystem: sync-hooks
tags: [conflict-detection, role-filtering, finalization-gate, nn-resolution]
dependency_graph:
  requires: [14-01]
  provides: [conflict-detection-service, role-based-nn-hook, finalization-nn-gate, nn-count-plumbing]
  affects: [SyncService, useNNResolution, usePlantationAdmin, usePlantaciones]
tech_stack:
  added: []
  patterns: [conflict-detection-before-upsert, role-conditional-query, conflict-resolution-handlers]
key_files:
  created: []
  modified:
    - mobile/src/services/SyncService.ts
    - mobile/src/hooks/useNNResolution.ts
    - mobile/src/hooks/usePlantationAdmin.ts
    - mobile/src/hooks/usePlantaciones.ts
    - mobile/src/queries/plantationDetailQueries.ts
decisions:
  - "Conflict detection uses pre-check + continue pattern (skip upsert entirely for conflicted trees) rather than CASE WHEN in SQL"
  - "canResolve defaults to true for tecnico in plantation mode since query already filters by user"
  - "keepLocalResolution only clears conflict columns without re-resolving (local species stays, next sync overwrites server)"
metrics:
  duration: 217s
  completed: 2026-04-14T18:57:37Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 14 Plan 02: Service and Hook Layer for N/N Conflict Detection and Resolution Summary

Conflict detection in SyncService.pullFromServer with role-based N/N filtering in useNNResolution and finalization gate extension in usePlantationAdmin.

## Task Summary

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Conflict detection + finalization gate + NN plumbing | 5fcaf9a | SyncService.ts, usePlantationAdmin.ts, usePlantaciones.ts |
| 2 | Role-based useNNResolution with conflict state | cfc5ea6 | useNNResolution.ts, plantationDetailQueries.ts |

## Changes Made

### Task 1: Conflict detection in SyncService + gates + plumbing

**SyncService.ts (pullFromServer):**
- Added conflict detection before tree upsert: queries local tree species, compares with server species
- When conflict detected: writes `conflictEspecieId` and `conflictEspecieNombre` to local tree, then `continue` (skips upsert, preserving local especieId)
- When no conflict: clears conflict columns (`NULL`) during normal upsert
- Looks up server species name from local species table for human-readable conflict display

**usePlantationAdmin.ts:**
- Extended `ExpandedMeta` type with `unresolvedNNCount` and `unresolvedNNSubgroups`
- `fetchPlantationMeta` now extracts these from `checkFinalizationGate` result
- `handleFinalize` shows N/N-specific blocking message when `gate.unresolvedNNCount > 0` (before falling through to generic blocking message)

**usePlantaciones.ts:**
- Added `useLiveData` call for `getUnresolvedNNCountsPerPlantation`
- Built `nnCountMap` (Map<string, number>) and added to return object

### Task 2: Role-based useNNResolution with conflict state

**useNNResolution.ts:**
- Added `useCurrentUserId` and `useProfileData` for role detection
- Plantation-mode query is now role-conditional: admin uses `getNNTreesForPlantation`, tecnico uses `getNNTreesForPlantationByUser`
- Extended `NNTree` interface with `conflictEspecieId` and `conflictEspecieNombre`
- Added `getConflictForTree(treeId)` helper returning server species info or null
- Added `acceptServerResolution(treeId)` handler: resolves with server species + clears conflict columns
- Added `keepLocalResolution(treeId)` handler: clears conflict columns only (local species stays)
- Exposed `canResolve`, `isAdmin`, conflict helpers in return object

**plantationDetailQueries.ts:**
- Added `conflictEspecieId` and `conflictEspecieNombre` to select of both `getNNTreesForPlantation` and `getNNTreesForPlantationByUser`

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None found.

## Known Stubs

None - all data sources are wired to real queries.

## Self-Check: PASSED
