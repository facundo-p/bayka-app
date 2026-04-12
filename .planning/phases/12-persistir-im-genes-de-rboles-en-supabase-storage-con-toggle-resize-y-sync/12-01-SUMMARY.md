---
phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
plan: "01"
subsystem: data-layer
tags: [photos, storage, drizzle-migration, image-resize, supabase-rls]
dependency_graph:
  requires: []
  provides: [fotoSynced-column, drizzle-migration-0008, PhotoService-resize, TreeRepository-photo-sync, supabase-storage-rls]
  affects: [mobile/src/database/schema.ts, mobile/src/services/PhotoService.ts, mobile/src/repositories/TreeRepository.ts]
tech_stack:
  added: [expo-image-manipulator ~14.0.8]
  patterns: [single-pass-JPEG-resize, pitfall-6-fotoSynced-reset, pitfall-7-sincronizada-filter, pitfall-2-local-uri-filter]
key_files:
  created:
    - mobile/drizzle/0008_add_foto_synced.sql
    - supabase/migrations/008_tree_photos_storage.sql
  modified:
    - mobile/src/database/schema.ts
    - mobile/drizzle/meta/_journal.json
    - mobile/drizzle/migrations.js
    - mobile/src/services/PhotoService.ts
    - mobile/src/repositories/TreeRepository.ts
    - mobile/package.json
decisions:
  - "Single-pass JPEG compression: quality:1 at capture, manipulateAsync compress:0.85 — avoids double-JPEG degradation (Pitfall 3)"
  - "fotoSynced reset to false in updateTreePhoto — new local file requires re-upload (Pitfall 6)"
  - "getTreesWithPendingPhotos filters by subgroups.estado='sincronizada' — only upload photos from finalized+synced subgroups (Pitfall 7)"
  - "getTreesWithPendingPhotos filters fotoUrl.startsWith('file://') — prevents re-uploading remote paths from pull (Pitfall 2)"
  - "resizeAndSaveToDocument exported as _resizeForTest (underscore convention for test-only exports)"
metrics:
  duration: 101s
  completed_date: "2026-04-12"
  tasks: 2
  files: 7
---

# Phase 12 Plan 01: Data Layer Foundation (Schema Migration + PhotoService Resize + TreeRepository) Summary

**One-liner:** Drizzle migration 0008 adds fotoSynced column; PhotoService resizes to 1600px at capture via manipulateAsync; TreeRepository gains getTreesWithPendingPhotos (sincronizada + local filter) and markPhotoSynced helpers with safety pitfall mitigations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Drizzle migration + schema + install expo-image-manipulator | 6326d4c | schema.ts, 0008_add_foto_synced.sql, _journal.json, migrations.js, package.json |
| 2 | PhotoService resize + TreeRepository photo sync helpers + Supabase RLS migration | 50e85a0 | PhotoService.ts, TreeRepository.ts, 008_tree_photos_storage.sql |

## What Was Built

### Task 1: Drizzle Migration 0008 + Schema + expo-image-manipulator
- Added `fotoSynced: integer('foto_synced', { mode: 'boolean' }).notNull().default(false)` to trees table in schema.ts
- Created `mobile/drizzle/0008_add_foto_synced.sql` with `ALTER TABLE trees ADD foto_synced integer DEFAULT false NOT NULL`
- Updated `_journal.json` with entry idx 8 (tag: `0008_add_foto_synced`)
- Updated `migrations.js` to import and register `m0008` (critical: prevents silent splash hang per feedback_drizzle_migrations.md)
- Installed `expo-image-manipulator ~14.0.8` via `expo install`

### Task 2: PhotoService + TreeRepository + Supabase RLS
- **PhotoService.ts:** Replaced `copyToDocument` with `resizeAndSaveToDocument` using `manipulateAsync` at 1600px longest side, JPEG compress:0.85; `quality: 1` at picker capture (single-pass JPEG per Pitfall 3); landscape/portrait detection via `asset.width >= asset.height`
- **TreeRepository.ts:**
  - `getTreesWithPendingPhotos(plantacionId)`: innerJoin with subgroups, filters `estado='sincronizada'` (Pitfall 7) and `fotoUrl.startsWith('file://')` (Pitfall 2), `fotoSynced=false`
  - `markPhotoSynced(treeId)`: sets `fotoSynced=true` after Storage upload
  - `updateTreePhoto`: now resets `fotoSynced: false` when photo is replaced (Pitfall 6)
- **supabase/migrations/008_tree_photos_storage.sql**: RLS policies for `tree-photos` bucket — INSERT, SELECT, UPDATE for authenticated users

## Decisions Made

- **Single-pass JPEG:** `quality: 1` at capture + `compress: 0.85` in manipulateAsync. Double compression at `quality: 0.7` then again at JPEG encode produces visible artifacts.
- **fotoSynced default false:** New trees start unsynced; upload will set to true; replacing photo resets to false.
- **Pitfall 7 — only upload sincronizada subgroups:** Tree photos only uploaded after subgroup is synced, ensuring server has the tree record before the photo.
- **Pitfall 2 — file:// filter:** Prevents re-uploading photo URLs that were pulled from server (remote HTTPS paths).
- **_resizeForTest export:** Underscore convention for test-only function exports without polluting public API.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The data layer is complete and wired. Photo upload (PhotoSyncService) is implemented in Plan 02.

## Self-Check: PASSED

- `mobile/drizzle/0008_add_foto_synced.sql`: FOUND
- `supabase/migrations/008_tree_photos_storage.sql`: FOUND
- Commit 6326d4c: FOUND
- Commit 50e85a0: FOUND
