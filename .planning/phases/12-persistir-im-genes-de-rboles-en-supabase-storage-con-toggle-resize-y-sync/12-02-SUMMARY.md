---
phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
plan: "02"
subsystem: sync
tags: [photo-sync, storage, supabase, upload, download, useSync]
dependency_graph:
  requires: ["12-01"]
  provides: ["uploadPendingPhotos", "downloadPhotosForPlantation", "PhotoSyncProgress", "useSync-photo-states"]
  affects: ["mobile/src/services/SyncService.ts", "mobile/src/hooks/useSync.ts"]
tech_stack:
  added: []
  patterns: ["batch-safe iteration with continue-on-failure", "expo-file-system File.arrayBuffer for Storage upload", "signed URL download pattern"]
key_files:
  created: []
  modified:
    - mobile/src/services/SyncService.ts
    - mobile/src/hooks/useSync.ts
    - mobile/tests/services/PhotoService.test.ts
    - mobile/tests/sync/SyncService.test.ts
    - mobile/tests/repositories/TreeRepository.test.ts
decisions:
  - "ExpoFile aliased import not needed — File from expo-file-system used as ExpoFile import alias to avoid clash with global File"
  - "supabase.from('trees').update used for foto_url server update after upload (not RPC)"
  - "downloadPhotosForPlantation skips file:// URIs via JS filter — avoids DB round-trip"
metrics:
  duration: "~15min"
  completed: "2026-04-12"
  tasks: 2
  files: 5
---

# Phase 12 Plan 02: SyncService Photo Upload/Download + useSync Extension Summary

SyncService extended with `uploadPendingPhotos` and `downloadPhotosForPlantation` functions using Supabase Storage, and useSync hook extended with `incluirFotos` toggle, `uploading-photos`/`downloading-photos` states, and photo progress tracking.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | SyncService photo upload + download functions | 7b80b8b | mobile/src/services/SyncService.ts |
| 2 | useSync hook extension + unit tests | 103ac34 | useSync.ts, 3 test files |

## What Was Built

### Task 1: SyncService Photo Functions

Added to `mobile/src/services/SyncService.ts`:

- **`PhotoSyncProgress` type** — `{ total: number; completed: number }` exported type
- **`uploadPhotoToStorage` helper** — reads local file via `ExpoFile.arrayBuffer()`, uploads to `supabase.storage.from('tree-photos').upload()` with `upsert: true`
- **`uploadPendingPhotos(plantacionId, onProgress?)`** — calls `getTreesWithPendingPhotos`, iterates trees, uploads each photo, updates `trees.foto_url` on server with relative path `plantations/{id}/trees/{id}.jpg`, calls `markPhotoSynced` on success. Continues on individual failures.
- **`downloadPhotosForPlantation(plantacionId, onProgress?)`** — queries local subgroups + trees with non-`file://` fotoUrls, creates signed URLs, downloads via `ExpoFile.downloadFileAsync`, updates local `fotoUrl` + `fotoSynced=true`
- **`pullFromServer` update** — tree `onConflictDoUpdate` now includes `fotoUrl: sql\`excluded.foto_url\`` so pulled trees receive server's foto_url

### Task 2: useSync Extension + Tests

Updated `mobile/src/hooks/useSync.ts`:
- `SyncState` now includes `'uploading-photos' | 'downloading-photos'`
- `startSync(incluirFotos: boolean = true)` — after subgroup sync, if `incluirFotos`, transitions to `uploading-photos` and calls `uploadPendingPhotos`
- `startPull(incluirFotos: boolean = true)` — after pull, if `incluirFotos`, transitions to `downloading-photos` and calls `downloadPhotosForPlantation`
- `reset()` clears `photoProgress` and `photoResult`
- New return values: `photoProgress: PhotoSyncProgress | null`, `photoResult: { uploaded?, failed?, downloaded? } | null`

Updated tests (41 tests total, all passing):
- **PhotoService.test.ts**: Added `expo-image-manipulator` mock, landscape/portrait resize tests, quality:1 picker test
- **SyncService.test.ts**: Added `expo-file-system` mock, TreeRepository mock, 6 new photo upload/download tests covering batch-safe continue-on-failure
- **TreeRepository.test.ts**: Added test verifying `updateTreePhoto` sets `fotoSynced: false`

## Test Results

```
Tests: 41 passed, 41 total
Test Suites: 3 passed, 3 total
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with minor implementation details:

1. `expo-file-system` File import aliased as `ExpoFile` to avoid potential global `File` conflict — matches plan's "Note: File may conflict with the global" guidance
2. `downloadPhotosForPlantation` uses JS `.filter()` on query results for `file://` exclusion rather than a separate DB query — equivalent behavior, same result
3. Test mock for `expo-file-system` uses constructor pattern with `MockFile.downloadFileAsync` static method — aligns with expo-file-system v19 static API

## Known Stubs

None — all functions are fully implemented. Photo upload and download use real Supabase Storage API calls.

## Self-Check: PASSED

- `mobile/src/services/SyncService.ts` — modified, contains `uploadPendingPhotos`, `downloadPhotosForPlantation`, `PhotoSyncProgress`
- `mobile/src/hooks/useSync.ts` — modified, contains `uploading-photos`, `incluirFotos`, `photoProgress`, `photoResult`
- Commits 7b80b8b and 103ac34 verified in git log
- All 41 tests pass
