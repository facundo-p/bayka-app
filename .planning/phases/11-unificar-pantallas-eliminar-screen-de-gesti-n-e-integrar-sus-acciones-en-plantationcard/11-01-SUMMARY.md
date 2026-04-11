---
phase: 11-unificar-pantallas-eliminar-screen-de-gesti-n-e-integrar-sus-acciones-en-plantationcard
plan: 01
subsystem: ui
tags: [react-native, bottom-sheet, modal, plantation-card, hooks]

# Dependency graph
requires:
  - phase: 04-admin-export
    provides: usePlantationAdmin hook with all admin action handlers
  - phase: 05-ux-improvements
    provides: PlantationCard component with sidebar strip
provides:
  - fetchPlantationMeta standalone async function (on-demand plantation metadata)
  - AdminBottomSheet component with estado-specific action lists
  - PlantationCard 3-slot sidebar strip (edit/gear/trash) with role gating
affects:
  - 11-02 (PlantacionesScreen wires onEdit/onGear and mounts AdminBottomSheet)
  - 11-03 (AdminScreen elimination)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetchPlantationMeta: exported standalone async function for on-demand meta fetching (no hook state)"
    - "3-slot sidebar strip: consistent card height via empty View placeholders for hidden slots"
    - "AdminBottomSheet: custom Modal slide-up with backdrop Pressable dismiss pattern"

key-files:
  created:
    - mobile/src/components/AdminBottomSheet.tsx
  modified:
    - mobile/src/hooks/usePlantationAdmin.ts
    - mobile/src/components/PlantationCard.tsx
    - mobile/src/screens/AdminScreen.tsx

key-decisions:
  - "fetchPlantationMeta exported as standalone async function (not inside hook) — callable on demand without subscribing to hook state"
  - "AdminScreen updated to manage local accordion/filter state (moved out of hook) — preserves current behavior until Plan 03 elimination"
  - "3-slot sidebar strip uses empty View placeholders for consistent card height across roles (D-04)"

patterns-established:
  - "Strip slot pattern: always render 3 slots, use empty View for hidden slots to maintain consistent height"
  - "AdminBottomSheet: estado-driven action list with disabled + helperText pattern for blocked actions"

requirements-completed: [UNIF-01, UNIF-02, UNIF-03]

# Metrics
duration: 18min
completed: 2026-04-11
---

# Phase 11 Plan 01: Refactor Hook + AdminBottomSheet + PlantationCard Sidebar Summary

**usePlantationAdmin stripped of accordion state; fetchPlantationMeta standalone export; AdminBottomSheet with estado-specific action lists; PlantationCard enriched with 3-slot edit/gear/trash sidebar strip**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-11T00:00:00Z
- **Completed:** 2026-04-11
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Removed all accordion/expand/filter state from `usePlantationAdmin` hook (expandedId, expandedMeta, handleToggleExpand, handleToggleFilter, filteredList, initialExpandDone, counts, activeFilter)
- Exported `fetchPlantationMeta` as a standalone async function callable on-demand — key building block for AdminBottomSheet
- Created `AdminBottomSheet` with slide-up animation, backdrop dismiss, pending sync/edit banner, discard button, and estado-specific action lists with disabled states + helper text
- Enriched `PlantationCard` with 3-slot right sidebar strip: edit (both roles), gear (admin-only), trash (existing) — with empty placeholders for hidden slots ensuring consistent height

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor usePlantationAdmin + create AdminBottomSheet** - `cf21e27` (feat)
2. **Task 2: Enrich PlantationCard with 3-slot sidebar strip** - `20872c1` (feat)

## Files Created/Modified
- `mobile/src/hooks/usePlantationAdmin.ts` — Stripped of accordion/filter state; added fetchPlantationMeta standalone export
- `mobile/src/components/AdminBottomSheet.tsx` — New slide-up bottom sheet with estado-specific admin actions
- `mobile/src/components/PlantationCard.tsx` — 3-slot right sidebar strip (edit/gear/trash) with role gating
- `mobile/src/screens/AdminScreen.tsx` — Migrated local accordion/filter state (moved out of hook); now uses fetchPlantationMeta

## Decisions Made
- **fetchPlantationMeta as standalone** — Exporting as a module-level async function (not inside the hook) allows it to be called imperatively when the user opens the bottom sheet, without needing to subscribe to hook state. This is the correct architecture for on-demand metadata fetching.
- **AdminScreen preservation** — AdminScreen still compiles and works by managing its own local accordion state. It will be eliminated in Plan 03 (D-10). Keeping it functional avoids breaking the app during the multi-plan refactor.
- **3-slot layout with empty View placeholders** — Per D-04, tecnico cards get an empty middle slot to maintain consistent card height across roles.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated AdminScreen to use local accordion state after hook removal**
- **Found during:** Task 1 (refactor usePlantationAdmin)
- **Issue:** AdminScreen imported `filteredList`, `counts`, `activeFilter`, `expandedId`, `expandedMeta`, `handleToggleFilter`, `handleToggleExpand` from the hook — all of which were removed. TypeScript would fail to compile.
- **Fix:** Migrated those variables to local state in AdminScreen using `fetchPlantationMeta` for on-demand meta fetching; AdminScreen now self-contained for accordion logic
- **Files modified:** `mobile/src/screens/AdminScreen.tsx`
- **Verification:** `npx tsc --noEmit` exits 0 with no errors
- **Committed in:** cf21e27 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to maintain TypeScript compilation integrity. AdminScreen will be deleted in Plan 03 anyway — this is a temporary bridge, not scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `usePlantationAdmin` hook is ready to be used in PlantacionesScreen (Plan 02)
- `fetchPlantationMeta` is exported and ready for AdminBottomSheet to call on gear tap
- `AdminBottomSheet` component is ready to be wired into PlantacionesScreen
- `PlantationCard` new props (`isAdmin`, `onEdit`, `onGear`) are ready to be consumed by PlantacionesScreen
- AdminScreen still functional — safe to deploy while Plans 02 and 03 complete the migration

---
*Phase: 11-unificar-pantallas-eliminar-screen-de-gesti-n-e-integrar-sus-acciones-en-plantationcard*
*Completed: 2026-04-11*
