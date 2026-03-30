---
phase: 03-sync-dashboard
plan: "01"
subsystem: sync-infrastructure
tags: [supabase-rpc, drizzle-migration, repository, sqlite-schema]
dependency_graph:
  requires: []
  provides: [sync_subgroup-rpc, plantation_users-local-table, markAsSincronizada, getFinalizadaSubGroups, getPendingSyncCount]
  affects: [03-02-sync-service, 03-03-dashboard-ui]
tech_stack:
  added: []
  patterns: [supabase-rpc-jsonb, drizzle-migration, on-conflict-do-nothing-idempotency]
key_files:
  created:
    - supabase/migrations/002_sync_rpc.sql
    - mobile/drizzle/0003_closed_zuras.sql
  modified:
    - mobile/src/database/schema.ts
    - mobile/src/repositories/SubGroupRepository.ts
    - mobile/drizzle/meta/_journal.json
decisions:
  - "SECURITY INVOKER chosen over DEFINER: existing RLS policies (auth.uid() = usuario_creador, auth.uid() = usuario_registro) already permit creator inserts, making DEFINER unnecessary"
  - "ON CONFLICT (id) DO NOTHING on both subgroups and trees: UUID as natural idempotency key, handles retry after network drop without partial upload risk"
  - "DUPLICATE_CODE check after INSERT: insert first (idempotent re-upload), then check for different-UUID conflict — order matters for correctness"
  - "getFinalizadaSubGroups returns SubGroup[] typed — matches SubGroupEstado union type already defined in repo"
metrics:
  duration: 115s
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 5
---

# Phase 3 Plan 01: Sync Infrastructure (RPC + Schema) Summary

**One-liner:** Postgres RPC sync_subgroup for atomic SubGroup+trees upload with JSONB idempotency, plus plantation_users SQLite table and three new SubGroupRepository functions for SyncService consumption.

## What Was Built

### Task 1: Supabase RPC Migration (002_sync_rpc.sql)

The `sync_subgroup(p_subgroup JSONB, p_trees JSONB)` function runs as a single Postgres transaction with:

- **Idempotent SubGroup insert**: `INSERT ... ON CONFLICT (id) DO NOTHING` — re-uploading the same UUID is a no-op, handles retry after network drop
- **DUPLICATE_CODE detection**: After insert, checks if a *different* UUID has the same `plantation_id + codigo`. Returns `{success: false, error: 'DUPLICATE_CODE'}` for conflict resolution UI
- **Idempotent tree inserts**: `jsonb_array_elements(p_trees)` iteration with `ON CONFLICT (id) DO NOTHING` per tree
- **SECURITY INVOKER**: RLS policies already enforce `auth.uid() = usuario_creador` (subgroups) and `auth.uid() = usuario_registro` (trees), so no DEFINER needed
- **EXCEPTION WHEN OTHERS**: Returns `{success: false, error: 'UNKNOWN'}` instead of crashing
- **GRANT EXECUTE** to `authenticated` role

Server sets `estado = 'sincronizada'` on INSERT — server is source of truth for sync state.

### Task 2: Local Schema + SubGroupRepository Extensions

**plantation_users in schema.ts:** Added `plantationUsers` SQLiteTable with columns `plantationId`, `userId`, `rolEnPlantacion` (default 'tecnico'), `assignedAt`, and `uniqueIndex` on `(plantationId, userId)`. Required for DASH-01 tecnico role-filtering without network.

**Drizzle migration 0003_closed_zuras.sql:** Auto-generated via `drizzle-kit generate`. Contains `CREATE TABLE plantation_users` with the composite unique index.

**Three new SubGroupRepository exports:**
- `markAsSincronizada(subgrupoId)`: Updates `estado = 'sincronizada'` + calls `notifyDataChanged()` — called by SyncService after confirmed RPC success
- `getFinalizadaSubGroups(plantacionId)`: Returns all `SubGroup[]` with `estado = 'finalizada'` for a plantation — SyncService fetch-before-loop input
- `getPendingSyncCount()`: Counts all `finalizada` subgroups across all plantations — dashboard badge data source

All imports (and, eq, count, notifyDataChanged) were already present in SubGroupRepository.ts — no new imports needed.

## Verification

- All acceptance criteria verified via grep counts
- Full test suite: 46 tests, 10 suites, all PASS
- No regressions introduced

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] supabase/migrations/002_sync_rpc.sql exists (commit b1e6c06)
- [x] mobile/drizzle/0003_closed_zuras.sql exists (commit 97714d0)
- [x] mobile/src/database/schema.ts modified (commit 97714d0)
- [x] mobile/src/repositories/SubGroupRepository.ts modified (commit 97714d0)
- [x] mobile/drizzle/meta/_journal.json updated (commit 97714d0)
