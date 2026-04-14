---
phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
plan: 01
subsystem: data-layer
tags: [migration, drizzle, supabase-rpc, queries, sync, nn-resolution]
dependency_graph:
  requires: []
  provides: [tree-conflict-columns, sync-rpc-do-update, syncable-subgroups-simplified, finalization-gate-nn, dashboard-nn-query, role-filtered-nn-query]
  affects: [mobile/src/database/schema.ts, supabase/migrations/009_sync_subgroup_update_trees.sql]
tech_stack:
  added: []
  patterns: [drizzle-migration-3-file, supabase-rpc-create-or-replace]
key_files:
  created:
    - mobile/drizzle/0010_add_tree_conflict_columns.sql
    - supabase/migrations/009_sync_subgroup_update_trees.sql
  modified:
    - mobile/drizzle/meta/_journal.json
    - mobile/drizzle/migrations.js
    - mobile/src/database/schema.ts
    - mobile/src/repositories/SubGroupRepository.ts
    - mobile/src/queries/adminQueries.ts
    - mobile/src/queries/dashboardQueries.ts
    - mobile/src/queries/plantationDetailQueries.ts
decisions:
  - "Removed isNull import from SubGroupRepository since N/N filter was the only consumer"
  - "Supabase RPC DO UPDATE limited to species_id and sub_id only (T-14-01 mitigation)"
metrics:
  duration: "2m 43s"
  completed: "2026-04-14T18:55:02Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 7
---

# Phase 14 Plan 01: Data Layer - Migrations, Schema, and Query Functions Summary

Drizzle migration for tree conflict columns, Supabase RPC updated from DO NOTHING to DO UPDATE for tree species re-sync, getSyncableSubGroups simplified to allow N/N subgroups, finalization gate extended with N/N counts, and two new NN query functions added.

## Task Results

### Task 1: Drizzle migration + Supabase RPC migration + schema update
**Commit:** 071c296

- Created Drizzle migration 0010 adding `conflict_especie_id` and `conflict_especie_nombre` columns to trees table
- Updated `_journal.json` (idx 10) and `migrations.js` (m0010 import + entry) -- all 3 Drizzle files updated per splash-hang prevention rule
- Added `conflictEspecieId` and `conflictEspecieNombre` to schema.ts trees table definition
- Created Supabase migration 009: `CREATE OR REPLACE FUNCTION sync_subgroup` with `ON CONFLICT (id) DO UPDATE SET species_id, sub_id` for trees while keeping subgroup INSERT as `DO NOTHING`

### Task 2: Remove N/N filter + extend finalization gate + add NN queries
**Commit:** a74f780

- **SubGroupRepository.ts:** Simplified `getSyncableSubGroups` to query directly with 3 conditions (plantacionId + finalizada + pendingSync=true) without N/N count filtering. Removed unused `isNull` import.
- **adminQueries.ts:** Extended `checkFinalizationGate` return type with `unresolvedNNCount` and `unresolvedNNSubgroups`. Added N/N count query. `canFinalize` now requires `unresolvedNNCount === 0`.
- **dashboardQueries.ts:** Added `getUnresolvedNNCountsPerPlantation()` using innerJoin trees+subgroups with `isNull(trees.especieId)` grouped by plantacionId.
- **plantationDetailQueries.ts:** Added `getNNTreesForPlantationByUser(plantacionId, userId)` filtering by `subgroups.usuarioCreador` for tecnico-scoped N/N view.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
