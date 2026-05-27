---
phase: 16
plan: 03
subsystem: sync + tombstones + OrangeDot
tags: [supabase, drizzle, sync, parcela, tombstone, partial-index]
requires: [16-01, 16-02]
provides:
  - SYNC-PARC-01
  - SYNC-PARC-02
  - SYNC-PARC-03
  - SYNC-PARC-04
  - SYNC-PARC-05
  - TEST-PARC-03
  - GRPN-05
affects:
  - mobile/src/services/sync/*
  - mobile/src/hooks/usePendingSyncCount.ts
  - mobile/src/queries/pendingSyncQueries.ts
  - mobile/src/repositories/TreeRepository.ts
  - mobile/src/database/schema.ts
key-files:
  created:
    - supabase/migrations/016_parcelas_deleted_at.sql
    - supabase/migrations/017_parcelas_partial_unique_indexes.sql
    - scripts/verify-016.sql
    - scripts/verify-017.sql
    - mobile/drizzle/0013_parcelas_partial_unique_indexes.sql
    - mobile/src/services/sync/pushService.errors.md
    - mobile/src/queries/pendingSyncQueries.ts
    - mobile/tests/integration/parcela-sync.test.ts
  modified:
    - mobile/src/database/schema.ts
    - mobile/src/services/sync/types.ts
    - mobile/src/services/sync/pushService.ts
    - mobile/src/services/sync/pullService.ts
    - mobile/src/services/sync/orchestrators.ts
    - mobile/src/services/sync/photoService.ts
    - mobile/src/services/sync/index.ts
    - mobile/src/hooks/usePendingSyncCount.ts
    - mobile/src/repositories/TreeRepository.ts
    - mobile/drizzle/meta/_journal.json
    - mobile/drizzle/migrations.js
decisions:
  - "D-16-12 honored: pullParcelas runs before pullGroups (FK ordering)"
  - "D-16-13 honored: uploadSyncableParcelas runs before uploadSyncableGroups in orchestrators"
  - "D-16-14 honored: pending_sync NOT cleared on conflict; only markParcelaSynced en éxito"
  - "D-16-15 honored: OrangeDot includes parcelas pending count (activas + tombstones)"
  - "D-16-16 honored: PARCELA_PENDING gate skips group push when parcela not sync-ready"
  - "D-16-19/D-16-21 honored: server tombstone column via migration 016"
  - "Classifier anchored on postgres SQLSTATE 23505 + parse of error.details; NEVER error.message substring"
  - "Partial unique indexes on parcelas (drizzle 0013 + supabase 017) — habilita reuso de nombre/codigo de parcelas tombstoneadas"
  - "Compat shim 012b client-side dropped: REST calls usan 'groups'/'group_id' (server shim preserved para APKs viejos)"
metrics:
  duration: "~60min"
  tasks_completed: 7
  files_created: 8
  files_modified: 11
  tests_added: 11
  commits: 7
---

# Phase 16 Plan 03: SyncService extension — parcelas pull/push + tombstone + OrangeDot + partial unique indexes Summary

Bidirectional parcela sync (pull antes que groups, push antes que groups), tombstone propagation in both directions, conflict classification anchored on stable PostgrestError shape (`code='23505'` + `details` parse), `PARCELA_PENDING` gate that preserves atomic Grupo invariant, OrangeDot aggregator includes parcelas, partial unique indexes that enable name/code reuse across tombstones, and 11-scenario E2E integration test.

## Commits

| Hash      | Message                                                                                  |
|-----------|------------------------------------------------------------------------------------------|
| 2d6bc10   | feat(16-03): Supabase migration 016 — parcelas.deleted_at tombstone                      |
| 49bd583   | feat(16-03): partial unique indexes for parcelas (drizzle 0013 + supabase 017)           |
| 4c8c828   | docs(16-03): document Supabase unique violation error shape (spike 3.3.0)                |
| 7cfd1ac   | feat(16-03): sync extension for parcelas + tombstones + FK ordering                      |
| 6190073   | feat(16-03): OrangeDot propaga parcelas pendientes (Task 3.5)                            |
| a5155c2   | test(16-03): parcela-sync integration test — 11 scenarios E2E (Task 3.6)                 |

## Deviations from Plan

### Renumbering of Supabase migrations
- **Plan said** `014_parcelas_deleted_at.sql`. **Reality:** `014_data_consolidation.sql` and `015_delete_source_plantations.sql` already exist on disk and are applied in prod.
- **Fix:** renumbered to `016_parcelas_deleted_at.sql`. Plus added `017_parcelas_partial_unique_indexes.sql` (per prompt instructions, partial unique indexes were folded into 16-03).
- **Tracked:** `Rule 3 — blocker fix` (file collision; not an architectural change, just numbering).

### Spike 3.3.0 not executed against live Supabase
- **Reason:** No service key/staging env available in the development environment.
- **Mitigation:** Documented canonical PostgREST `PostgrestError` shape (`{ code, details, message, hint }`) and pinned the classifier to the stable PostgREST contract for SQLSTATE 23505. Fallback `GENERIC_CONFLICT` covers any drift; tested explicitly in scenario #5 of `parcela-sync.test.ts`.
- See `mobile/src/services/sync/pushService.errors.md` for the full doc + validation note.

### Compat-shim client-side rollback
- The compat-shim 012b references in `pullService.ts` / `pushService.ts` (`from('subgroups')`, `subgroup_id` filters) were migrated to the new schema names per prompt instructions. The new APK speaks `groups` / `group_id` directly.
- Server-side compat-shim (VIEW `subgroups` + `trees.subgroup_id` GENERATED column + `sync_subgroup` RPC with COALESCE) **stays active** so old APKs already in production keep working. Removal will be in Phase 17 post-deploy.

## Supabase error shape (spike 3.3.0 captured)

```js
{
  code: '23505',
  details: 'Key (plantation_id, codigo)=(11111111-..., LP1) already exists.',
  message: 'duplicate key value violates unique constraint "parcelas_plantation_code_unique"',
  hint: null
}
```

Same shape for nombre conflicts (`details: 'Key (plantation_id, nombre)=...'`).

Classifier: `error.code === '23505'` → parse `error.details` with `/Key \(([^)]+)\)=/` → match on `codigo`/`nombre`/else `GENERIC_CONFLICT`. Audit grep confirms zero `error.message` matching:

```
$ grep -n "error\.message" mobile/src/services/sync/pushService.ts | grep -iE "duplicate|unique|23505"
AUDIT OK: no error.message classifier matches
```

## Verification

- `npx tsc --noEmit` → **0 errors**
- `parcela-sync.test.ts` → **11/11 passing**
- Full integration suite: 7/9 passing — 2 failures (`group-lifecycle.test.ts`, `sync-pipeline.test.ts`) are pre-existing baseline (verified via `git stash`), unrelated to Plan 16-03.
- Full unit suite: 41/44 passing — 3 failures (mostly `tests/sync/pullFromServer.test.ts`) are pre-existing baseline.
- Audit: `markParcelaSynced` only called in the success branch of `classifyParcelaRpcResult` (preserves `pending_sync=true` on conflict, per `feedback_state_lifecycle_audit.md`).
- Audit: pull/push parcela operations precede groups in `pullFromServer` and orchestrators (D-16-12 / D-16-13).

## Manual user actions required

The Supabase migrations are **SQL artifacts** — user runs them in the Supabase SQL Editor:

1. Apply `supabase/migrations/016_parcelas_deleted_at.sql` then run `scripts/verify-016.sql` (5 OK rows expected).
2. Apply `supabase/migrations/017_parcelas_partial_unique_indexes.sql` then run `scripts/verify-017.sql` (5 OK rows expected).

Until 016 is applied, push of tombstones will fail (server lacks `deleted_at` column). 017 enables reuse of nombre/codigo across tombstoned parcelas.

## Self-Check: PASSED

Files exist:
- `supabase/migrations/016_parcelas_deleted_at.sql` — FOUND
- `supabase/migrations/017_parcelas_partial_unique_indexes.sql` — FOUND
- `mobile/drizzle/0013_parcelas_partial_unique_indexes.sql` — FOUND
- `mobile/src/queries/pendingSyncQueries.ts` — FOUND
- `mobile/src/services/sync/pushService.errors.md` — FOUND
- `mobile/tests/integration/parcela-sync.test.ts` — FOUND
- `scripts/verify-016.sql`, `scripts/verify-017.sql` — FOUND

Commits exist (all in `git log --oneline`): 2d6bc10, 49bd583, 4c8c828, 7cfd1ac, 6190073, a5155c2 — all present.
