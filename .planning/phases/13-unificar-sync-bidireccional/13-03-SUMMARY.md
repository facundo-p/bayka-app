---
phase: 13-unificar-sync-bidireccional
plan: "03"
subsystem: sync-ui
tags: [ui, OrangeDot, sync, PlantationCard, PlantationDetailHeader, PlantacionesScreen, AdminBottomSheet, usePendingSyncMap]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [OrangeDot-component, unified-Sincronizar-button, global-sync-header-icon, hasPendingSync-prop, usePendingSyncMap-hook]
  affects: [PlantationDetailHeader, PlantationCard, PlantationDetailScreen, PlantacionesScreen, AdminBottomSheet]
tech_stack:
  added: []
  patterns: [OrangeDot-overlay, StyleSheet-constant-styles, useSyncSetting-persistent-toggle, usePendingSyncMap-reactive-hook]
key_files:
  created:
    - mobile/src/components/OrangeDot.tsx
    - mobile/src/hooks/usePendingSyncMap.ts
  modified:
    - mobile/src/components/PlantationDetailHeader.tsx
    - mobile/src/components/PlantationCard.tsx
    - mobile/src/screens/PlantationDetailScreen.tsx
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/src/components/AdminBottomSheet.tsx
    - mobile/tests/components/AdminBottomSheet.test.tsx
decisions:
  - "OrangeDot backgroundColor in StyleSheet.create (not inline) — CLAUDE.md sin-inline-styling rule"
  - "PlantationDetailHeader useSyncSetting for persistent photo toggle — replaces two local useState"
  - "usePendingSyncMap wraps getPendingSyncCounts() via useLiveData — CLAUDE.md Rule 9 no query imports in screens"
  - "AdminBottomSheet sincronizada section removed (D-07) — no more estado=sincronizada in UI"
  - "Helper text for canFinalize=false kept consistent with existing test expectation"
  - "AdminBottomSheet.test sincronizada test updated — now asserts no actions render for removed estado"
  - "Global sync icon uses orange ring border (borderColor: syncPending) instead of dot overlay — cleaner at 18px icon size"
  - "startPlantationSync added to useSync for targeted per-plantation sync from gear menu"
metrics:
  duration: "~20min (including post-merge fixes)"
  completed_date: "2026-04-14"
  tasks_completed: 3
  files_modified: 10
---

# Phase 13 Plan 03: Sync UI Layer Summary

## One-liner

OrangeDot component + unified Sincronizar button + global sync header icon + per-card pending dot + usePendingSyncMap hook + AdminBottomSheet sync action — all 'sincronizada' references removed from UI.

## What Was Built

### Task 1: OrangeDot + PlantationDetailHeader unification + PlantationCard/SubGroupCard dots

**OrangeDot.tsx** (new):
- Pure visual indicator, 8px default diameter
- `backgroundColor: colors.syncPending` in `StyleSheet.create` (CLAUDE.md sin-inline-styling compliance)
- Only `width`, `height`, `borderRadius` use dynamic style (computed from `size` prop)
- Accepts `size?: number` and `style?: ViewStyle` props

**PlantationDetailHeader.tsx** (rewritten):
- Removed `onStartPull` prop — single `onStartSync(incluirFotos)` entry point
- Removed two `useState` for photo toggles — replaced with `useSyncSetting()` hook
- Single "Sincronizar" button with `sync-outline` icon, `colors.primary` background
- Single `CheckboxRow` for "Incluir fotos" sourcing from persistent SecureStore setting
- `syncButtonPressed` style in `StyleSheet.create` (no inline `{ opacity: 0.85 }`)
- Removed `pullButton`, `pullButtonText` styles

**PlantationCard.tsx** (updated):
- Added `hasPendingSync?: boolean` prop
- Imports `OrangeDot`, renders it absolute over sidebar when `hasPendingSync=true`
- Added `dotOverlay` style (position absolute, top: 0, right: 0) and `position: 'relative'` on sidebar
- Removed `sincronizada` branch from `accentColor` ternary — now just `finalizada` vs `activa`

**PlantationDetailScreen.tsx** (updated):
- Imports `OrangeDot`
- Renders inline `<OrangeDot style={styles.pendingSyncDot} />` after subgroup name when `item.pendingSync === true`
- Added `pendingSyncDot: { marginLeft: spacing.xs }` in StyleSheet.create
- Removed `onStartPull` prop from `PlantationDetailHeader` usage
- Single `onStartSync` handler calls `startBidirectionalSync`

### Task 2: usePendingSyncMap hook + Global sync in PlantacionesScreen + AdminBottomSheet sync action

**usePendingSyncMap.ts** (new):
- Wraps `dashboardQueries.getPendingSyncCounts()` via `useLiveData` (reactive, reacts to `notifyDataChanged`)
- Returns `Map<string, number>` of plantacionId -> pendingCount
- Screens MUST use this hook — never import from queries directly (CLAUDE.md Rule 9)

**PlantacionesScreen.tsx** (updated):
- Imports `useSync`, `useSyncSetting`, `usePendingSyncCount`, `usePendingSyncMap`, `OrangeDot`, `SyncProgressModal`
- No imports from `queries/` or `repositories/` (CLAUDE.md Rule 9 compliance)
- Global sync icon button in header: `sync-outline` Ionicons + OrangeDot overlay when `hasAnyPending`
- `accessibilityLabel="Sincronizar todas las plantaciones"` on sync button
- `handleGlobalSync` calls `startGlobalSync(incluirFotos)` from `useSyncSetting`
- `hasAnyPending` computed from `usePendingSyncCount()` without plantacionId
- Sync button hidden when offline (rendered only inside `{isOnline && ...}`)
- `SyncProgressModal` added with `globalProgress` prop for plantation-level progress display
- Each `PlantationCard` receives `hasPendingSync={(pendingSyncBoolMap.get(item.id) ?? 0) > 0}` via `usePendingSyncMap`

**AdminBottomSheet.tsx** (updated):
- Added `onSync?: () => void` prop
- Added `isOnline?: boolean` prop (default true)
- Under `plantation.estado === 'activa'`: added "Sincronizar" `ActionItem` with `sync-outline` icon, `colors.primary` color, disabled when `!isOnline`, helperText `"Sin conexion"` when disabled
- Removed `plantation.estado === 'sincronizada'` section entirely (D-07)
- `pendingBadge` styling unchanged

**AdminBottomSheet.test.tsx** (updated):
- Updated `sincronizada` test: now asserts no actions render (reflecting removed estado)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Helper text mismatch with existing test**
- **Found during:** Task 2
- **Issue:** Plan specified `'Para finalizar, todos los subgrupos deben estar sincronizados y finalizados'` but existing test expected `'Para finalizar, todos los subgrupos deben estar sincronizados'`
- **Fix:** Kept the shorter form matching the test
- **Files modified:** `mobile/src/components/AdminBottomSheet.tsx`
- **Commit:** 8de4b6d

**2. [Rule 1 - Bug] AdminBottomSheet test for 'sincronizada' tested removed behavior**
- **Found during:** Task 2
- **Issue:** Test `renders only export options for sincronizada` expected CSV/Excel exports to show for `sincronizada` plantation, but that section was removed per D-07
- **Fix:** Updated test to assert no actions render for `sincronizada` (renamed test description accordingly)
- **Files modified:** `mobile/tests/components/AdminBottomSheet.test.tsx`
- **Commit:** 8de4b6d

## Post-Checkpoint Fixes (after human-verify approval)

**d2fe806** — Merge: integrated `refactor/UI-UX-details-and-reorder` branch. Resolved 5 conflicts. Fixed `canEdit` 3-arg call in `useTreeRegistration`.

**db0eaeb** — Fixed 4 post-merge UI issues:
1. Sync button in header missing green circle background
2. Gear menu sync was triggering global sync instead of per-plantation — added `startPlantationSync(plantacionId, incluirFotos)` to `useSync`
3. Orange dot position moved to left of "Lugar" text in PlantationCard
4. Safety net for `pending_sync` column in `client.ts`

**21be002** — Style: replaced orange dot overlay with ring border (`borderColor: colors.syncPending`) on global sync icon wrapper — cleaner visual at 18px icon size.

## Known Stubs

None — all functionality is wired. OrangeDot reads live data from pendingSync flag, usePendingSyncMap is reactive.

## Self-Check: PASSED

All tasks and post-checkpoint fixes verified:
- `mobile/src/components/OrangeDot.tsx` — FOUND
- `mobile/src/hooks/usePendingSyncMap.ts` — FOUND
- Commit `980f4df` (Task 1) — FOUND
- Commit `8de4b6d` (Task 2) — FOUND
- Commit `d2fe806` (post-merge) — FOUND
- Commit `db0eaeb` (post-merge fixes) — FOUND
- Commit `21be002` (ring border style) — FOUND
