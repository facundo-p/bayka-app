---
phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
plan: 03
subsystem: mobile-ui
tags: [nn-resolution, conflict-banner, finalization-gate, plantation-card]
dependency_graph:
  requires: [14-01, 14-02]
  provides: [nn-ui-complete]
  affects: [PlantationCard, AdminBottomSheet, NNResolutionScreen, PlantationDetailScreen, PlantacionesScreen]
tech_stack:
  added: []
  patterns: [conflict-banner-inline, finalization-gate-nn, role-based-resolution-ui]
key_files:
  created: []
  modified:
    - mobile/src/components/PlantationCard.tsx
    - mobile/src/components/AdminBottomSheet.tsx
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/src/screens/NNResolutionScreen.tsx
    - mobile/src/screens/PlantationDetailScreen.tsx
decisions:
  - Yellow theme colors (secondaryYellowDark/Light/Medium) for all N/N indicators
  - Conflict banner uses dangerBg/danger colors to distinguish from N/N badge
  - IIFE pattern for inline conflict check in JSX to avoid extra state
metrics:
  duration: 149s
  completed: 2026-04-14T19:07:30Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 14 Plan 03: UI Wiring for N/N Sync, Conflict Resolution, and Finalization Gate Summary

PlantationCard N/N stat with yellow help-circle icon, AdminBottomSheet finalization gate with N/N blocking text, NNResolutionScreen conflict banner with accept/keep actions, and PlantationDetailScreen N/N badge yellow theme correction.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PlantationCard N/N stat + AdminBottomSheet gate + PlantacionesScreen wiring | f903363 | PlantationCard.tsx, AdminBottomSheet.tsx, PlantacionesScreen.tsx |
| 2 | NNResolutionScreen conflict banner + PlantationDetailScreen N/N badge | f686ce6 | NNResolutionScreen.tsx, PlantationDetailScreen.tsx |

## Key Changes

### PlantationCard.tsx
- Added `nnCount?: number` prop
- Renders yellow help-circle-outline icon + count in statsRow when nnCount > 0
- Uses `colors.secondaryYellowDark` for icon and text color

### AdminBottomSheet.tsx
- Added `hasUnresolvedNN` derived from `meta.unresolvedNNCount`
- Extended `finalizeDisabled` to include N/N check
- Extended `finalizeHelperText` with N/N-specific message using Spanish pluralization
- Priority: pending sync > unresolved N/N > not all synced

### PlantacionesScreen.tsx
- Destructured `nnCountMap` from `usePlantaciones()`
- Passed `nnCount={nnCountMap.get(item.id) ?? 0}` to PlantationCard

### NNResolutionScreen.tsx
- Destructured `canResolve`, `getConflictForTree`, `acceptServerResolution`, `keepLocalResolution` from hook
- Added conflict banner above species grid with dangerBg background and danger left border
- Banner shows "Conflicto detectado" heading and server species name
- Two actions: "Aceptar del servidor" (primary color) and "Mantener la mia" (secondary)
- Added `canResolve` gate: hides species selector and shows "Resolucion pendiente" when false
- All styles in StyleSheet.create (no inline styles)

### PlantationDetailScreen.tsx
- Fixed nnBadge styles from secondaryBg/secondary to secondaryYellowLight/secondaryYellowDark/secondaryYellowMedium
- Updated borderRadius from xl to full per UI-SPEC
- Updated fontFamily from semiBold to bold per UI-SPEC

## Deviations from Plan

None - plan executed exactly as written.

## Checkpoint: Human Verification (Task 3)

Auto-approved per workflow.auto_advance configuration. The following verification steps should be performed when convenient:

1. PlantationCard shows yellow help-circle icon with N/N count
2. AdminBottomSheet blocks finalization with N/N-specific message
3. SubGroupCard shows yellow N/N badge
4. NNResolutionScreen shows conflict banner when tree has server conflict
5. Accept/keep actions work correctly on conflict banner
6. Species selector hidden when canResolve is false

## Self-Check: PASSED
