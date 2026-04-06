---
phase: 07-eliminar-plantacion-local
plan: 02
subsystem: ui
tags: [react-native, catalog, delete, confirmation-dialog, pressable]

requires:
  - phase: 07-01
    provides: "deletePlantationLocally repository function, getUnsyncedSubgroupSummary query"
  - phase: 06-02
    provides: "CatalogScreen, CatalogPlantationCard, DownloadProgressModal"
provides:
  - "Delete button (trash icon) on downloaded plantation cards in CatalogScreen"
  - "Single confirmation dialog for safe deletes (all data synced)"
  - "Double confirmation dialog for unsynced data deletes with subgroup counts"
  - "Automatic UI refresh after deletion (card reverts to downloadable state)"
affects: []

tech-stack:
  added: []
  patterns:
    - "showConfirmDialog/showDoubleConfirmDialog with useConfirm hook for confirmation flows"
    - "onDelete callback prop pattern for card-level delete actions"

key-files:
  created: []
  modified:
    - src/components/CatalogPlantationCard.tsx
    - src/screens/CatalogScreen.tsx

key-decisions:
  - "Replaced 'Ya descargada' badge with trash icon - cleaner UI, actionable"
  - "Removed disabled={isDownloaded} from outer Pressable to allow trash icon interaction"

patterns-established:
  - "Delete confirmation with unsynced detection: check counts, branch to single or double confirm"

requirements-completed: [DEL-03-unsynced-warning-ui, DEL-04-catalog-delete-action, DEL-05-both-roles-delete]

duration: 93s
completed: 2026-04-06
---

# Phase 07 Plan 02: Delete Plantation UI Summary

**Trash icon on downloaded catalog cards with single/double confirmation dialog based on unsynced subgroup detection**

## Performance

- **Duration:** 93s
- **Started:** 2026-04-06T04:21:13Z
- **Completed:** 2026-04-06T04:22:46Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 2

## Accomplishments
- Downloaded plantation cards now show a trash icon instead of "Ya descargada" badge
- Delete flow detects unsynced subgroups and shows appropriate confirmation dialog
- Single confirm for safe deletes, double confirm with counts for unsynced data
- UI refreshes automatically after deletion (card reverts to downloadable state)
- Both admin and tecnico roles can delete (no role-gating on delete action)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add onDelete prop to CatalogPlantationCard** - `103bf3a` (feat)
2. **Task 2: Wire delete flow into CatalogScreen** - `2739484` (feat)
3. **Task 3: Verify delete plantation flow** - auto-approved (checkpoint)

## Files Created/Modified
- `src/components/CatalogPlantationCard.tsx` - Added onDelete prop, trash icon, removed downloadedBadge
- `src/screens/CatalogScreen.tsx` - Added handleDeletePlantation with unsynced detection and confirmation dialogs

## Decisions Made
- Replaced "Ya descargada" text badge with trash icon (actionable, cleaner)
- Removed disabled={isDownloaded} from outer Pressable so trash icon can be tapped on downloaded cards

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Delete plantation feature complete end-to-end (data layer from Plan 01 + UI from Plan 02)
- Phase 07 fully complete, ready for next phase

---
*Phase: 07-eliminar-plantacion-local*
*Completed: 2026-04-06*
