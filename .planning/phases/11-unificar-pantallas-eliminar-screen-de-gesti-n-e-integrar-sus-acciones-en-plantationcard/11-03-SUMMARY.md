---
phase: 11-unificar-pantallas-eliminar-screen-de-gesti-n-e-integrar-sus-acciones-en-plantationcard
plan: "03"
subsystem: screens/navigation
tags: [unification, admin, plantation-card, bottom-sheet, navigation]
dependency_graph:
  requires: ["11-01"]
  provides: ["unified-plantaciones-screen", "2-tab-admin-layout"]
  affects: ["PlantacionesScreen", "admin-layout", "PlantationCard"]
tech_stack:
  added: []
  patterns: ["role-aware rendering", "two-confirm-modal pattern", "bottom-sheet with async meta fetch"]
key_files:
  created: []
  modified:
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/app/(admin)/_layout.tsx
  deleted:
    - mobile/app/(admin)/admin.tsx
    - mobile/src/screens/AdminScreen.tsx
decisions:
  - "usePlantationAdmin called unconditionally (React hook rules) — cheap for tecnico since result is unused"
  - "Two ConfirmModal instances (delete vs admin) are safe because delete and admin actions cannot fire simultaneously"
  - "AdminBottomSheet conditionally rendered with {isAdmin &&} — avoids attaching Modal to non-admin DOM tree"
  - "Alert.alert for edit-blocked non-activa plantations — simple feedback matching pattern in usePlantationAdmin"
metrics:
  duration: "107s"
  completed_date: "2026-04-11"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 4
---

# Phase 11 Plan 03: Wire PlantacionesScreen + Remove Gestion Tab Summary

Unified plantation management into PlantacionesScreen with AdminBottomSheet, AdminPlantationModals, and role-aware PlantationCard props; removed Gestion tab and deleted AdminScreen.

## What Was Built

**Task 1 — Wire PlantacionesScreen with admin actions + bottom sheet + header button**

PlantacionesScreen now serves as the single plantation screen for both roles:

- `usePlantationAdmin()` called unconditionally (React hook rules) — its data only used when `isAdmin`
- Header `rightElement` now wraps both buttons in `headerButtons` View (flexDirection row): `+` create button (admin only) + download icon
- `handleOpenGear(item)` — async function that fetches `ExpandedMeta` via `fetchPlantationMeta` before opening `AdminBottomSheet`
- `handleEditPress(item)` — opens `PlantationFormModal` for activa, shows `Alert.alert` for finalizada/sincronizada
- `PlantationCard` receives `isAdmin`, `onEdit`, `onGear` props in `renderItem`
- `AdminBottomSheet` rendered conditionally `{isAdmin && ...}` with all 7 action callbacks
- `AdminPlantationModals` rendered conditionally `{isAdmin && ...}` — covers create, edit, seed, species config, assign tech, export overlay
- Two separate `ConfirmModal` instances: one from `usePlantaciones` (delete) and one embedded in `AdminPlantationModals` via `adminHook.confirmProps` — mutually exclusive

**Task 2 — Remove Gestion tab + delete AdminScreen files**

- `mobile/app/(admin)/_layout.tsx` — removed `<Tabs.Screen name="admin">` block entirely; 3 entries remain: `plantaciones`, `perfil`, `plantation` (hidden)
- `mobile/app/(admin)/admin.tsx` — DELETED (Expo Router auto-registers files; leaving it would ghost-create the tab)
- `mobile/src/screens/AdminScreen.tsx` — DELETED (all functionality migrated to PlantacionesScreen + AdminBottomSheet + usePlantationAdmin)
- Verified zero dangling imports of `AdminScreen` anywhere in the codebase

**Task 3 — Visual verification** (checkpoint — awaiting human verification)

TypeScript compiles with zero errors post-deletion.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `db13d74` | feat(11-03): wire PlantacionesScreen with admin actions, bottom sheet, + create button |
| 2 | `3725d4b` | feat(11-03): remove Gestion tab, delete AdminScreen + admin.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all admin actions are fully wired through `usePlantationAdmin` handlers which existed from Plan 01.

## Self-Check: PASSED

- `mobile/src/screens/PlantacionesScreen.tsx` — exists, contains all required patterns
- `mobile/app/(admin)/_layout.tsx` — exists, has 3 Tabs.Screen entries, no "admin" or "Gestion"
- `mobile/app/(admin)/admin.tsx` — DELETED (confirmed)
- `mobile/src/screens/AdminScreen.tsx` — DELETED (confirmed)
- Commits db13d74 and 3725d4b exist in git log
- TypeScript: 0 errors
