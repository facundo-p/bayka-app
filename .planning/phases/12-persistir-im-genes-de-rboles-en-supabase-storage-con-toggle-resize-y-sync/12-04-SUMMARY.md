---
phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
plan: 04
subsystem: ui
tags: [react-native, drizzle, sqlite, photo-sync, tree-list]

requires:
  - phase: 12-03
    provides: fotoSynced column in SQLite schema and data layer

provides:
  - fotoSynced field exposed from useTrees hook to consumers
  - Amber sync dot on photo icon in TreeListModal when photo not synced
  - Blue sync dot on photo icon in TreeListModal when photo synced

affects: [TreeRegistrationScreen, any screen consuming useTrees or TreeListModal]

tech-stack:
  added: []
  patterns:
    - "Sync dot pattern: absolute 8px circle positioned top-right on icon, amber=pending, blue=synced (matches TreeRow.tsx)"

key-files:
  created: []
  modified:
    - mobile/src/hooks/useTrees.ts
    - mobile/src/components/TreeListModal.tsx

key-decisions:
  - "fotoSynced is optional (?) in TreeListItem interface — backward-compatible with call sites that don't pass it yet"
  - "Sync dot only renders when fotoUrl is truthy — guard is in the photo icon ternary branch, matching TreeRow.tsx pattern"

patterns-established:
  - "syncDot style: position absolute, top -2, right -2, 8x8px, borderRadius 4, reuse across row components with syncDotSynced override"

requirements-completed: [IMG-07]

duration: 5min
completed: 2026-04-12
---

# Phase 12 Plan 04: Gap Closure — fotoSynced Sync Dot in TreeListModal Summary

**fotoSynced column wired from useTrees query through TreeListItem interface to amber/blue sync dots in TreeListModal photo icon**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-12T00:00:00Z
- **Completed:** 2026-04-12T00:05:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `fotoSynced: trees.fotoSynced` to the `useTrees` db.select() query — the column was in the schema but not being selected
- Added `fotoSynced?: boolean` to `TreeListItem` interface in TreeListModal
- Replaced bare photo icon with icon+sync-dot composite view: amber dot (`colors.stateFinalizada`) when photo not synced, dark blue dot (`colors.statSynced`) when synced
- Added `syncDot` and `syncDotSynced` styles matching the established TreeRow.tsx pattern exactly

## Task Commits

1. **Task 1: Add fotoSynced to tree query and TreeListModal sync dot** - `9ee238d` (feat)

## Files Created/Modified

- `mobile/src/hooks/useTrees.ts` — Added `fotoSynced: trees.fotoSynced` to select object
- `mobile/src/components/TreeListModal.tsx` — Added fotoSynced to TreeListItem interface, sync dot JSX, and syncDot/syncDotSynced styles

## Decisions Made

- `fotoSynced` is typed as `optional` (`?`) in `TreeListItem` to remain backward-compatible with any existing call sites that construct TreeListItem objects without the field (e.g., tests).
- The sync dot conditional is nested inside the `item.fotoUrl` truthy branch — consistent with the TreeRow.tsx pattern where dots only appear when a photo exists.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- fotoSynced is now fully visible to users in the tree list modal
- The photo sync flow (take photo → upload → mark synced) is now end-to-end visible in the UI
- No blockers for subsequent phases

---
*Phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync*
*Completed: 2026-04-12*
