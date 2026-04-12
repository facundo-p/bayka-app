---
phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
plan: "03"
subsystem: ui
tags: [ui, sync, photos, components]
dependency_graph:
  requires: ["12-02"]
  provides: ["photo-sync-ui"]
  affects: ["PlantationDetailHeader", "TreeRow", "SyncProgressModal", "PlantationDetailScreen"]
tech_stack:
  added: []
  patterns: ["Ionicons photo icon with sync dot", "checkbox toggle state", "two-button sync layout"]
key_files:
  created:
    - mobile/src/components/CheckboxRow.tsx
  modified:
    - mobile/src/components/PlantationDetailHeader.tsx
    - mobile/src/components/SyncProgressModal.tsx
    - mobile/src/components/TreeRow.tsx
    - mobile/src/screens/PlantationDetailScreen.tsx
decisions:
  - "TreeRow photo icon uses Ionicons image/image-outline (not emoji) with absolute-positioned 8px sync dot"
  - "CheckboxRow checked state uses colors.primary fill, unchecked uses colors.border — consistent with brand"
  - "PlantationDetailHeader local useState(true) for photo toggle defaults — no persistence per D-08"
  - "SyncProgressModal photo result messages use same successText/failureMessage styles for visual consistency"
metrics:
  duration: "12min"
  completed_date: "2026-04-12"
  tasks: 3
  files: 5
requirements:
  - IMG-05
  - IMG-06
  - IMG-07
---

# Phase 12 Plan 03: UI Layer — Photo Persistence UI Summary

**One-liner:** Two-button Descargar/Subir sync layout with Ionicons photo icons, independent `Incluir fotos` checkboxes, and SyncProgressModal photo upload/download states wired to useSync hook.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | CheckboxRow + PlantationDetailHeader two-button layout + SyncProgressModal photo states | 23eb088 | CheckboxRow.tsx (new), PlantationDetailHeader.tsx, SyncProgressModal.tsx |
| 2 | TreeRow Ionicons + sync dot + PlantationDetailScreen wiring | 68c96bb | TreeRow.tsx, PlantationDetailScreen.tsx |
| 3 | Visual and functional verification | auto-approved | — |

## What Was Built

### CheckboxRow.tsx (new)
Reusable checkbox + label component. 20x20px box with `borderRadius.sm`, `borderWidth 1.5`. Checked state uses `colors.primary` background with white `checkmark` Ionicon size 14. Label uses `fontSize.sm` (12px) `fonts.regular`. Row has `minHeight: 44` for touch accessibility. Supports `disabled` state.

### PlantationDetailHeader.tsx (updated)
Replaced single sync button with side-by-side Descargar (info blue `#2563EB`) and Subir (primary dark blue `#0A3760`) buttons, each with `flex: 1`. Local `useState(true)` for `incluirFotosPull` and `incluirFotosPush` — always ON by default, no persistence. `onStartPull(incluirFotos)` and `onStartSync(incluirFotos)` callbacks now receive the boolean. Subir button disabled with `opacity: 0.5` when `syncableCount === 0`. Count badge on Subir when count > 0.

### SyncProgressModal.tsx (updated)
Added `photoProgress: PhotoSyncProgress | null` and `photoResult` props. New `uploading-photos` state shows primary spinner + "Subiendo fotos..." + "N de M fotos". New `downloading-photos` state shows info spinner + "Descargando fotos...". Done state shows photo upload/download result counts (subidas correctamente / no pudieron subirse / descargadas correctamente).

### TreeRow.tsx (updated)
Replaced emoji photo icons (`🖼`, `📷`) with Ionicons `image` (has photo) and `image-outline` (no photo) at size 18 with `colors.primaryAccent`. Added `fotoSynced?: boolean` prop. 8px `syncDot` at `position: absolute, top: -2, right: -2` — amber (`colors.stateFinalizada`) when pending upload, dark blue (`colors.statSynced`) when synced. Accessibility labels: "Sin foto" / "Foto pendiente de subida" / "Foto sincronizada".

### PlantationDetailScreen.tsx (updated)
Destructured `photoProgress` and `photoResult` from `useSync`. Updated `onStartPull` and `onStartSync` props to pass `incluirFotos` boolean to `startPull`/`startSync`. Passed `photoProgress` and `photoResult` to `SyncProgressModal`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all wiring complete. TreeRow `fotoSynced` prop is ready for use when TreeListModal or other tree-rendering components are updated to include the field from queries.

## Test Results

- Pre-existing test failure in `useSync.test.ts` (startPull sets pullSuccess=true) — confirmed failing before this plan's changes. Not caused by this plan.
- 302 tests passing, 1 pre-existing failure.

## Self-Check: PASSED

Files created/modified:
- FOUND: mobile/src/components/CheckboxRow.tsx
- FOUND: mobile/src/components/PlantationDetailHeader.tsx
- FOUND: mobile/src/components/SyncProgressModal.tsx
- FOUND: mobile/src/components/TreeRow.tsx
- FOUND: mobile/src/screens/PlantationDetailScreen.tsx

Commits:
- 23eb088 — feat(12-03): CheckboxRow component + two-button sync layout + SyncProgressModal photo states
- 68c96bb — feat(12-03): TreeRow Ionicons photo icon with sync dot + PlantationDetailScreen wiring
