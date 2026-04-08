---
phase: 10-creaci-n-de-plantaci-n-offline-sync-cat-logo-de-especies
plan: 01
subsystem: database
tags: [drizzle, sqlite, supabase, offline-first, sync, species, plantation]

# Dependency graph
requires:
  - phase: 06-admin-sync
    provides: SyncService with syncPlantation, pullFromServer, downloadPlantation
  - phase: 04-admin-export
    provides: PlantationRepository with createPlantation, saveSpeciesConfig, deletePlantationLocally

provides:
  - pending_sync column on plantations table (migration 0006)
  - createPlantationLocally in PlantationRepository (offline plantation creation)
  - saveSpeciesConfigLocally in PlantationRepository (offline species config, no Supabase)
  - pullSpeciesFromServer in SyncService (upsert-only species catalog sync)
  - uploadOfflinePlantations in SyncService (idempotent upload of pendingSync=true plantations)
  - syncPlantation now calls pullSpeciesFromServer + uploadOfflinePlantations before pullFromServer

affects: [10-02-ui-offline-plantation, sync, admin-screens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pendingSync=true marks locally-created rows that need uploading to Supabase"
    - "23505 duplicate key treated as idempotent success — proceed with dependent uploads"
    - "pullSpeciesFromServer uses upsert-only (never delete) to preserve SubID integrity"
    - "uploadOfflinePlantations wraps in try/catch inside syncPlantation — non-blocking"

key-files:
  created:
    - mobile/drizzle/0006_add_pending_sync.sql
    - mobile/tests/admin/PlantationRepository.offline.test.ts
    - mobile/tests/sync/SyncService.offline.test.ts
  modified:
    - mobile/drizzle/migrations.js
    - mobile/src/database/schema.ts
    - mobile/src/repositories/PlantationRepository.ts
    - mobile/src/services/SyncService.ts

key-decisions:
  - "pendingSync stored as INTEGER (0/1) in SQLite, mapped to boolean in Drizzle schema"
  - "pullSpeciesFromServer: non-blocking — returns early on error (stale catalog acceptable)"
  - "uploadOfflinePlantations: 23505 = idempotent re-upload, continues to species upsert"
  - "downloadPlantation and online createPlantation explicitly set pendingSync=false"
  - "saveSpeciesConfigLocally: no Supabase call — pure local SQLite write for offline flow"

patterns-established:
  - "Offline-first mutation pattern: insert locally with pendingSync=true, upload in syncPlantation"
  - "Idempotent upload pattern: use UUID as natural key, 23505 = already uploaded, proceed"

requirements-completed: [OFPL-01, OFPL-02, OFPL-03, OFPL-04, OFPL-05, OFPL-06]

# Metrics
duration: 5min
completed: 2026-04-08
---

# Phase 10 Plan 01: Offline Plantation Data Layer Summary

**SQLite migration + 4 new functions enabling offline plantation creation and species catalog sync before UI wiring in Plan 02**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-08T18:12:15Z
- **Completed:** 2026-04-08T18:17:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added `pending_sync` column to plantations table via migration 0006, registered in migrations.js
- Added `createPlantationLocally` (offline, UUID via Crypto.randomUUID, pendingSync=true) and `saveSpeciesConfigLocally` (local-only SQLite write) to PlantationRepository
- Added `pullSpeciesFromServer` (upsert-only, non-blocking) and `uploadOfflinePlantations` (handles 23505 idempotently) to SyncService, wired into `syncPlantation`
- Set `pendingSync=false` in `downloadPlantation` and online `createPlantation` to correctly mark server-originated rows
- 15 new unit tests across 2 test files, all passing, no regressions in existing 24 test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + offline plantation data functions** - `359509f` (feat)
2. **Task 2: Species catalog sync + offline plantation upload + unit tests** - `1628671` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `mobile/drizzle/0006_add_pending_sync.sql` - Migration adding pending_sync INTEGER NOT NULL DEFAULT 0
- `mobile/drizzle/migrations.js` - Registered m0006 migration
- `mobile/src/database/schema.ts` - Added pendingSync boolean field to plantations table
- `mobile/src/repositories/PlantationRepository.ts` - Added createPlantationLocally + saveSpeciesConfigLocally
- `mobile/src/services/SyncService.ts` - Added pullSpeciesFromServer + uploadOfflinePlantations, wired into syncPlantation
- `mobile/tests/admin/PlantationRepository.offline.test.ts` - 8 tests for offline repository functions
- `mobile/tests/sync/SyncService.offline.test.ts` - 7 tests for species sync + offline upload

## Decisions Made
- `pendingSync` stored as SQLite INTEGER (0/1) and mapped to Drizzle boolean — consistent with existing schema conventions
- `pullSpeciesFromServer` returns early on any Supabase error (non-blocking) — stale catalog is acceptable for tree registration
- 23505 PostgreSQL error code signals idempotent re-upload: plantation already on server, proceed with species and mark synced
- `saveSpeciesConfigLocally` intentionally has no Supabase call — offline flow writes locally first, upload deferred to syncPlantation
- `downloadPlantation` and online `createPlantation` explicitly set `pendingSync: false` to prevent re-uploading server-originated rows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `node_modules` not present in worktree (worktrees don't share node_modules). Created symlink to `bayka-app-redesign/mobile/node_modules` for TypeScript and Jest execution. The symlink resolves transparently since both share the same package.json.
- Pre-existing TypeScript error in `SubGroupRepository.ts` (line 273: tipo string vs SubGroupTipo) confirmed on main branch — not caused by this plan's changes.
- 3 pre-existing failing test suites on main branch (5 tests total) — unchanged by this plan.

## Known Stubs

None — all functions are fully implemented with real data flows. No placeholder data or hardcoded empty values.

## Next Phase Readiness
- Data layer complete: createPlantationLocally + saveSpeciesConfigLocally ready for UI wiring in Plan 02
- syncPlantation already calls pullSpeciesFromServer + uploadOfflinePlantations — no changes needed in SyncService for Plan 02
- OFPL-03 (subgroup FK on offline plantation) is satisfied by the pending row existing locally in SQLite

---
*Phase: 10-creaci-n-de-plantaci-n-offline-sync-cat-logo-de-especies*
*Completed: 2026-04-08*
