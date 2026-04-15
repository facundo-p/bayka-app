---
phase: 13-unificar-sync-bidireccional
plan: "02"
subsystem: sync-orchestration
tags: [sync, bidirectional, useSync, SyncService, SyncProgressModal, useSyncSetting, SecureStore]
dependency_graph:
  requires: [13-01]
  provides: [syncAllPlantations, startBidirectionalSync, startGlobalSync, useSyncSetting, globalProgress-display]
  affects: [SyncService, useSync, useSyncSetting, SyncProgressModal, PlantationDetailScreen, SyncService.test, useSync.test]
tech_stack:
  added: []
  patterns: [pull-then-push-unified, global-sync-loop, SecureStore-setting-persistence]
key_files:
  created:
    - mobile/src/hooks/useSyncSetting.ts
  modified:
    - mobile/src/services/SyncService.ts
    - mobile/src/hooks/useSync.ts
    - mobile/src/components/SyncProgressModal.tsx
    - mobile/src/screens/PlantationDetailScreen.tsx
    - mobile/tests/sync/SyncService.test.ts
    - mobile/tests/hooks/useSync.test.ts
decisions:
  - "startBidirectionalSync replaces startSync+startPull — single entry point does pull-then-push via syncPlantation"
  - "syncAllPlantations runs global pre-steps (species, offline plantations, pending edits) once then loops plantations"
  - "pullFromServer sets pendingSync=false on all upserted subgroups — server data is always considered synced"
  - "SyncProgressModal 'syncing' state removed — replaced with 'pushing' to match bidirectional flow semantics"
  - "plantacionId optional in useSync — globalSync variant works without plantation scope"
metrics:
  duration: "~5min"
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_modified: 7
---

# Phase 13 Plan 02: Sync Orchestration Unification Summary

## One-liner

Unified pull+push sync into startBidirectionalSync; added syncAllPlantations for global cross-plantation sync; new useSyncSetting hook persists photo inclusion to SecureStore; SyncProgressModal updated with pulling/pushing/done phases and global progress display.

## What Was Built

### Task 1: SyncService updates + useSyncSetting hook + useSync unification

**SyncService.ts** changes:
- Replaced `markAsSincronizada` import/call with `markSubGroupSynced` (aligns with Plan 01 pendingSync model)
- `pullFromServer` subgroup upsert now sets `pendingSync: false` in both insert values and `onConflictDoUpdate.set` — server data is already synced (Research Pitfall 5)
- Added `GlobalSyncProgress` interface for per-plantation progress reporting
- Added `syncAllPlantations(onProgress, incluirFotos)` — runs global pre-steps once (species catalog, offline plantations, pending edits), then loops all local plantations doing pull+push, finishes with optional photo sync across all plantations

**useSyncSetting.ts** (new):
- Reads `sync_include_photos` key from SecureStore on mount
- `toggleIncluirFotos(value: boolean)` persists value to SecureStore
- Default is `true` (include photos)

**useSync.ts** refactored:
- `SyncState` renamed `'syncing'` → `'pushing'` to match bidirectional semantics
- Added `globalProgress` state for per-plantation progress during global sync
- `startSync` + `startPull` replaced with single `startBidirectionalSync(incluirFotos)` — calls `syncPlantation` (which does pull-then-push internally) then optionally photo upload+download
- Added `startGlobalSync(incluirFotos)` — calls `syncAllPlantations`, updates `globalProgress` and `state` (pulling/pushing) from progress callback, flattens all plantation results
- `plantacionId` parameter made optional to support global sync without plantation scope
- Hook return exposes `startBidirectionalSync`, `startGlobalSync`, `globalProgress`

**PlantationDetailScreen.tsx** (auto-fixed, Rule 3):
- Updated to use `startBidirectionalSync` (both onStartPull and onStartSync now use unified method)
- Removed stale `sincronizada` filter from subgroupFilterConfigs (D-07: estado no longer exists)

### Task 2: Update SyncProgressModal for bidirectional phase display

**SyncProgressModal.tsx** changes:
- Removed `'syncing'` block — replaced with `'pushing'` block showing "Subiendo subgrupos..." with ActivityIndicator in `colors.primary`
- `'pulling'` block shows "Actualizando datos..." with ActivityIndicator in `colors.info`
- Both `pulling` and `pushing` states render `globalProgress` line: "Sincronizando {name}... ({done+1} de {total} plantaciones)"
- Done state (results.length > 0): "Sincronizacion completa" / "Sincronizacion parcial" (without accent, consistent with existing UI)
- Added `plantationProgress` style for the global progress line
- `globalProgress` prop is optional — no breaking change for existing callers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PlantationDetailScreen used old startSync/startPull API**
- **Found during:** Task 1
- **Issue:** Screen destructured `startSync` and `startPull` from `useSync` — no longer exported
- **Fix:** Updated to use `startBidirectionalSync` for both pull and sync actions
- **Files modified:** `mobile/src/screens/PlantationDetailScreen.tsx`
- **Commit:** 02fefd5

**2. [Rule 3 - Blocking] SyncService tests mocked `markAsSincronizada` (removed function)**
- **Found during:** Task 1 (post-test run)
- **Issue:** `tests/sync/SyncService.test.ts` mocked the removed `markAsSincronizada` causing 2 test failures
- **Fix:** Updated mock and assertions to use `markSubGroupSynced`
- **Files modified:** `mobile/tests/sync/SyncService.test.ts`
- **Commit:** 2c4df1b

**3. [Rule 2 - Missing] useSync tests covered old startSync/startPull**
- **Found during:** Task 1
- **Issue:** Test file tested removed functions, missing coverage for startBidirectionalSync and startGlobalSync
- **Fix:** Rewrote useSync.test.ts to cover new API including startGlobalSync with flatted results and error handling
- **Files modified:** `mobile/tests/hooks/useSync.test.ts`
- **Commit:** 02fefd5

## Known Stubs

None — all functionality is wired. `globalProgress` in SyncProgressModal renders live data from useSync state.

## Self-Check: PASSED
