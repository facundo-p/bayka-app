---
phase: 04-admin-export
plan: "01"
subsystem: data-layer
tags: [admin, export, rls, repository, queries, services, tdd]
dependency_graph:
  requires: []
  provides:
    - "supabase/migrations/003_admin_policies.sql"
    - "mobile/src/queries/adminQueries.ts"
    - "mobile/src/queries/exportQueries.ts"
    - "mobile/src/repositories/PlantationRepository.ts"
    - "mobile/src/services/ExportService.ts"
  affects:
    - "Plan 04-02 (admin screens depend on all 5 artifacts)"
    - "Plan 04-03 (detail screen wiring depends on PlantationRepository + adminQueries)"
tech_stack:
  added:
    - "xlsx ^0.18.5 (SheetJS — Excel export)"
    - "expo-sharing ^55.0.14 (native share sheet)"
  patterns:
    - "Server-first mutation → pullFromServer → notifyDataChanged"
    - "TDD: RED (failing tests) → GREEN (implementation) → 21 tests pass"
    - "RFC 4180 CSV quoting for fields with commas"
    - "SheetJS base64 output (required in React Native — no Node Buffer)"
key_files:
  created:
    - supabase/migrations/003_admin_policies.sql
    - mobile/src/queries/adminQueries.ts
    - mobile/src/queries/exportQueries.ts
    - mobile/src/repositories/PlantationRepository.ts
    - mobile/src/services/ExportService.ts
    - mobile/tests/admin/adminQueries.test.ts
    - mobile/tests/admin/PlantationRepository.test.ts
    - mobile/tests/admin/ExportService.test.ts
  modified:
    - mobile/package.json (added xlsx, expo-sharing)
decisions:
  - "Pre-existing SubGroupRepository.ts TS error (tipo: string not assignable to SubGroupTipo) is out of scope — logged, not fixed (deviation rule: scope boundary)"
  - "expo-sharing cannot be node-required directly — expected (Expo module uses ESM); confirmed package.json install OK"
metrics:
  duration: "347s"
  completed: "2026-03-20"
  tasks: 2
  files: 10
---

# Phase 4 Plan 01: Admin Data Layer Summary

**One-liner:** RLS migration (8 policies), admin query functions, PlantationRepository mutations, ExportService with RFC 4180 CSV + SheetJS base64 Excel, and 21 passing unit tests.

## Tasks Completed

| # | Task | Commit | Result |
|---|------|--------|--------|
| 1 | Install dependencies + RLS migration | e101c79 | 8 policies in 003_admin_policies.sql; xlsx + expo-sharing in package.json |
| 2 | Create adminQueries, exportQueries, PlantationRepository, ExportService + tests (TDD) | 6d6ea4f | 21/21 tests pass; 4 production files; TypeScript clean |

## What Was Built

### RLS Migration (`supabase/migrations/003_admin_policies.sql`)
8 policies granting admin role INSERT/UPDATE/DELETE on `plantations`, `plantation_species`, `plantation_users`, and org-wide SELECT on `profiles` (needed for technician listing). Does not duplicate existing read policies from migration 001.

### adminQueries.ts (8 functions)
- `checkFinalizationGate` — returns blocking subgroups for finalization gate (PLAN-06)
- `getMaxGlobalId` — MAX(global_id) for seed suggestion, returns 0 if none (IDGN-04)
- `getPlantationEstado` — reads plantation estado for UI gating
- `getAllTechnicians` — queries Supabase profiles (not local SQLite — no profiles table locally)
- `getPlantationSpeciesConfig` — local JOIN plantation_species + species
- `getAssignedTechnicians` — local plantation_users query
- `hasTreesForSpecies` — prevents removal of species with registered trees (PLAN-02 safety)
- `hasIdsGenerated` — gates export buttons and prevents ID re-generation (IDGN-01)

### exportQueries.ts (1 function)
- `getExportRows` — JOINs trees → subgroups → plantations → species, returns 7-column export structure ordered by globalId ASC (EXPO-03)

### PlantationRepository.ts (5 functions)
- `createPlantation` — Supabase INSERT + local upsert (Pitfall 2: pullFromServer skips plantation row)
- `finalizePlantation` — server + local UPDATE (Pitfall 6: both must be updated)
- `saveSpeciesConfig` — server DELETE + INSERT + pullFromServer
- `assignTechnicians` — server DELETE + INSERT + pullFromServer
- `generateIds` — local db.transaction with deterministic ORDER BY (subgroups.createdAt ASC, trees.posicion ASC) per Pitfall 3

### ExportService.ts (2 functions)
- `exportToCSV` — RFC 4180 quoting for comma-containing fields, FileSystem.cacheDirectory, mimeType 'text/csv'
- `exportToExcel` — SheetJS json_to_sheet + write with type:'base64' (Pitfall 4: no Node Buffer in RN), FileSystem.EncodingType.Base64

## Test Results

```
Test Suites: 3 passed, 3 total
Tests:       21 passed, 21 total (8 adminQueries + 8 PlantationRepository + 5 ExportService)

Full suite: 16 suites, 103 tests — all passing
```

## Deviations from Plan

### Out-of-Scope Pre-existing Issue (Not Fixed)
**SubGroupRepository.ts TypeScript error** — `tipo: string` not assignable to `SubGroupTipo`
- **Found during:** TypeScript check on new files
- **Status:** Pre-existing (confirmed via git stash before/after check — error present before our changes)
- **Action:** Logged to deferred-items. Not fixed per scope boundary rule.
- **Impact on this plan:** None — new files compile cleanly. Pre-existing error does not affect functionality.

None of the planned work required deviations.

## Self-Check: PASSED

All 10 artifacts verified present. Both commits (e101c79, 6d6ea4f) verified in git log.
