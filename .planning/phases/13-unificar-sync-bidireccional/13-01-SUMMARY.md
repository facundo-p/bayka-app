---
phase: 13-unificar-sync-bidireccional
plan: "01"
subsystem: sync-model
tags: [drizzle, schema, repositories, queries, hooks, theme]
dependency_graph:
  requires: []
  provides: [pendingSync-flag, SubGroupEstado-simplified, syncPending-color]
  affects: [SubGroupRepository, TreeRepository, adminQueries, dashboardQueries, plantationDetailQueries, catalogQueries, usePlantationDetail, usePlantationAdmin, usePendingSyncCount, StatusChip]
tech_stack:
  added: []
  patterns: [pendingSync-dirty-flag, plantationEstado-gate-for-canEdit]
key_files:
  created:
    - mobile/drizzle/0009_add_subgroup_pending_sync.sql
  modified:
    - mobile/drizzle/meta/_journal.json
    - mobile/drizzle/migrations.js
    - mobile/src/database/schema.ts
    - mobile/src/repositories/SubGroupRepository.ts
    - mobile/src/repositories/TreeRepository.ts
    - mobile/src/theme.ts
    - mobile/src/queries/adminQueries.ts
    - mobile/src/queries/dashboardQueries.ts
    - mobile/src/queries/plantationDetailQueries.ts
    - mobile/src/queries/catalogQueries.ts
    - mobile/src/hooks/usePlantationDetail.ts
    - mobile/src/hooks/usePlantationAdmin.ts
    - mobile/src/hooks/usePendingSyncCount.ts
    - mobile/src/components/StatusChip.tsx
    - mobile/tests/database/subgroup.test.ts
    - mobile/tests/database/tree.test.ts
    - mobile/tests/repositories/TreeRepository.test.ts
    - mobile/tests/admin/adminQueries.test.ts
    - mobile/tests/hooks/usePlantationAdmin.test.ts
    - mobile/tests/sync/dashboard.test.ts
decisions:
  - "pendingSync defaults to false on migration — existing server data is already synced (Research Pitfall 6)"
  - "canEdit now checks plantacionEstado (not subgroup estado) — plantation finalizada = immutable, simpler logic"
  - "checkFinalizationGate requires estado=finalizada AND pendingSync=false — ensures local changes are uploaded before plantation finalize"
  - "SubGroupEstado simplified to activa|finalizada — sincronizada removed per D-07"
  - "getPendingSyncCount counts pendingSync=true (any estado) — orange dot shows for any pending subgroup"
metrics:
  duration: "534s (~9min)"
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_modified: 20
---

# Phase 13 Plan 01: Data Model Foundation — pendingSync Flag Summary

## One-liner

pendingSync boolean column added to subgroups via Drizzle migration; SubGroupEstado simplified to activa|finalizada; all mutations mark pendingSync=true; checkFinalizationGate requires finalizada AND pendingSync=false.

## What Was Built

### Task 1: Drizzle migration + schema + SubGroupRepository + TreeRepository refactor

Created `mobile/drizzle/0009_add_subgroup_pending_sync.sql` with `ALTER TABLE subgroups ADD pending_sync integer DEFAULT 0 NOT NULL`. Updated journal and migrations.js to include m0009. Added `pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false)` to schema.ts subgroups table.

SubGroupRepository was refactored:
- `SubGroupEstado` is now `'activa' | 'finalizada'` (no 'sincronizada')
- `SubGroup` interface gains `pendingSync: boolean` field
- `markSubGroupPendingSync(id)` added — sets pendingSync=true
- `markSubGroupSynced(id)` replaces `markAsSincronizada` — sets pendingSync=false (not estado)
- `canEdit(subgroup, userId, plantacionEstado)` — gates on plantation estado instead of subgroup estado
- `createSubGroup` inserts `pendingSync: true` explicitly
- `finalizeSubGroup`, `updateSubGroup`, `updateSubGroupCode`, `reactivateSubGroup` all call `markSubGroupPendingSync`
- `getPendingSyncCount` counts `pendingSync=true` (any estado) instead of `estado=finalizada`

TreeRepository was wired:
- `insertTree`, `deleteLastTree`, `reverseTreeOrder`, `deleteTreeAndRecalculate` call `markSubGroupPendingSync(subgrupoId)` after mutations
- `resolveNNTree`, `updateTreePhoto` query `subgrupoId` from tree and call `markSubGroupPendingSync`
- `getTreesWithPendingPhotos` filters by `pendingSync=false` instead of `estado='sincronizada'`

Added `colors.syncPending: '#F97316'` (orange-500) to theme.ts state chips section.

### Task 2: Update all queries, hooks, and components

All 'sincronizada' references in queries/hooks/StatusChip removed and replaced with pendingSync boolean:

- `adminQueries.ts`: `checkFinalizationGate` selects pendingSync, blocks on `estado!='finalizada' || pendingSync`. `getTechnicianUnsyncedSubgroupCount` uses `pendingSync=true`.
- `dashboardQueries.ts`: `getUnsyncedTreeCounts` uses `pendingSync=true`. `getPendingSyncCounts` uses `pendingSync=true`. `getSyncedTreeCounts` uses `pendingSync=false`.
- `plantationDetailQueries.ts`: `getUnsyncedTreesForUser` uses `pending_sync = 1` in SQL subquery.
- `catalogQueries.ts`: `getUnsyncedSubgroupSummary` uses `pendingSync=true`.
- `usePlantationDetail.ts`: `subgroupEstadoCounts` has only `activa` and `finalizada` keys.
- `usePlantationAdmin.ts`: removed `sincronizada` branch from `fetchPlantationMeta`.
- `usePendingSyncCount.ts`: main query uses `pendingSync=true`, photos query uses `pendingSync=false`.
- `StatusChip.tsx`: removed `sincronizada` entry from CHIP_CONFIG.

Test files updated to match new signatures and behaviors: 302 tests passing.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Additional Work (Rule 2)

**Test suite updates** — All 6 test suites that tested the old 'sincronizada' behavior were updated to reflect the new pendingSync model. This was required to maintain test suite integrity. Updated:
- `canEdit` tests to use new 3-param signature with `plantacionEstado`
- `finalizeSubGroup` test to expect 2 `updateWhere` calls (estado + pendingSync)
- `reverseTreeOrder` and `resolveNNTree` tests to expect additional update calls for `markSubGroupPendingSync`
- `checkFinalizationGate` tests to use `pendingSync: false` in fixture data
- `getPendingSyncCounts` test to expect `pendingSync=true` filter
- Removed `idsGenerated=true for sincronizada` test from `usePlantationAdmin` (D-07: sincronizada estado no longer exists)

## Known Stubs

None — all functionality is wired. `syncPending` color token is defined and ready for Plan 02 UI usage.

## Self-Check: PASSED
