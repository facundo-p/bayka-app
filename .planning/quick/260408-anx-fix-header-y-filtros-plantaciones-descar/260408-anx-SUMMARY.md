---
phase: quick-fix
plan: 01
subsystem: mobile/screens
tags: [ui, plantaciones, catalog, filter, header]
key-files:
  modified:
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/src/screens/CatalogScreen.tsx
decisions:
  - "Empty state rendered inside TexturedBackground wrapper so header is always visible"
  - "CatalogScreen computes estadoCounts/filteredCatalog at component level (outside renderContent) so filterConfigs are available in JSX scope"
metrics:
  duration: ~5min
  completed: 2026-04-08
  tasks: 2
  files: 2
---

# Quick Fix 260408-anx: Fix Header y Filtros Plantaciones Descar

## One-liner

Header with download icon always visible on PlantacionesScreen; activa/finalizada FilterCards added to CatalogScreen with estado-based filtering.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Show header with download icon when no plantations downloaded | 7b4db2e | PlantacionesScreen.tsx |
| 2 | Add activa/finalizada filter cards to CatalogScreen | ec7ef6b | CatalogScreen.tsx |

## What Was Done

### Task 1 — PlantacionesScreen header always visible

The previous code had an early `return` when `plantationList` was empty or null, rendering a plain `View` with no `ScreenHeader`. This hid the download icon button entirely, leaving users with no way to navigate to the catalog to download their first plantations.

Fix: removed the early return. The main render now always starts with `TexturedBackground` + `ScreenHeader`. Content below the header is conditional — if plantations exist, show `FilterCards` + `FlatList`; otherwise show the empty state centered in the remaining space. Also removed `backgroundColor: colors.background` from `emptyContainer` since `TexturedBackground` handles the screen background.

### Task 2 — CatalogScreen filter cards

`CatalogScreen` was missing the activa/finalizada filter cards that `PlantacionesScreen` already had. Added:
- `activeFilter` state (reset to `null` on `loadCatalog`)
- `estadoCounts` computed from `catalogItems`
- `filterConfigs` array with same shape as PlantacionesScreen
- `filteredCatalog` derived list for the FlatList `data` prop
- `FilterCards` + `Animated.View` wrapper rendered above the FlatList in `renderContent`
- Imports: `Animated`, `FadeInDown` from `react-native-reanimated`, `FilterCards` from components

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `PlantacionesScreen.tsx` modified: confirmed
- `CatalogScreen.tsx` modified: confirmed
- Commit 7b4db2e exists: confirmed
- Commit ec7ef6b exists: confirmed
- TypeScript: 0 errors on both passes
