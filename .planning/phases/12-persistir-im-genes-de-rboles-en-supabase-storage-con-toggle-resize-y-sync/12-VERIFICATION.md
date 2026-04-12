---
phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
verified: 2026-04-12T15:00:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 12/13
  gaps_closed:
    - "fotoSynced column now selected in useTrees.ts (trees.fotoSynced at line 15)"
    - "TreeListItem interface in TreeListModal.tsx now has fotoSynced?: boolean field"
    - "TreeListModal renderItem renders amber syncDot when fotoUrl && !fotoSynced, dark blue syncDotSynced when fotoUrl && fotoSynced"
    - "syncDot styles added: 8px absolute circle, top -2 right -2, borderRadius 4, matching TreeRow.tsx pattern exactly"
    - "Color tokens verified: colors.stateFinalizada (#F59E0B amber) and colors.statSynced (#0A3760 dark blue) in theme.ts"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Photo resize verification"
    expected: "Captured photos are 1600px on longest side when viewed in the app"
    why_human: "Cannot run image capture or inspect file dimensions programmatically without a running device"
  - test: "Push sync with Incluir fotos checked"
    expected: "SyncProgressModal shows 'Subiendo fotos...' state with 'N de M fotos' counter after SubGroup sync completes"
    why_human: "Requires live Supabase Storage bucket + real device sync flow"
  - test: "Pull sync with Incluir fotos checked"
    expected: "SyncProgressModal shows 'Descargando fotos...' state and downloads photos to local storage"
    why_human: "Requires live Supabase Storage with remote photos + real device"
  - test: "Incluir fotos unchecked skips photo step"
    expected: "Uncheck 'Incluir fotos', run sync — modal never shows photo progress state, completes without photo upload/download"
    why_human: "Requires device interaction with the sync modal"
  - test: "Amber dot visible on unsynced photo tree in TreeListModal"
    expected: "Tree with fotoUrl set and fotoSynced=false shows amber dot at top-right of image icon in the tree list"
    why_human: "Requires live device rendering to confirm the absolute-positioned dot is visible and correctly positioned"
  - test: "Dark blue dot visible on synced photo tree in TreeListModal"
    expected: "Tree with fotoUrl set and fotoSynced=true shows dark blue dot at top-right of image icon"
    why_human: "Requires completed sync cycle + live device rendering"
---

# Phase 12: Persistir imagenes de arboles en Supabase Storage Verification Report

**Phase Goal:** Upload tree photos from local device storage to Supabase Storage, with image resizing at capture time (1600px longest side), split Descargar/Subir sync buttons with independent "Incluir fotos" checkboxes, photo upload after SubGroup sync, photo download during pull, and fotoSynced tracking per tree.
**Verified:** 2026-04-12T15:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 12-04)

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Photos captured via camera or gallery are resized to 1600px on the longest side before saving | VERIFIED | `PhotoService.ts` uses `manipulateAsync` with `{ width: 1600 }` for landscape, `{ height: 1600 }` for portrait; `quality: 1` at picker capture |
| 2  | `fotoSynced` boolean column exists on local trees table via migration 0008 | VERIFIED | `schema.ts:46`, `0008_add_foto_synced.sql`, `_journal.json` idx 8, `migrations.js` imports m0008 |
| 3  | Replacing a tree photo resets fotoSynced to false | VERIFIED | `TreeRepository.ts:127` — `updateTreePhoto` sets `fotoSynced: false` |
| 4  | TreeRepository can query trees with pending photo uploads and mark them as synced | VERIFIED | `getTreesWithPendingPhotos` (filters sincronizada subgroups + file:// URIs), `markPhotoSynced` both present and wired |
| 5  | Supabase Storage RLS policies exist for tree-photos bucket | VERIFIED | `supabase/migrations/008_tree_photos_storage.sql` — INSERT, SELECT, UPDATE policies for authenticated users |
| 6  | Push flow uploads pending photos after SubGroup sync | VERIFIED | `SyncService.ts` exports `uploadPendingPhotos`; `useSync.ts` calls it after `syncPlantation` when `incluirFotos=true` |
| 7  | Pull flow downloads remote photos to local storage | VERIFIED | `SyncService.ts` exports `downloadPhotosForPlantation`; `useSync.ts` calls it after `pullFromServer` when `incluirFotos=true` |
| 8  | Photo upload/download is skipped when incluirFotos=false | VERIFIED | `useSync.ts:35,58` — both `startSync` and `startPull` gate photo functions behind `if (incluirFotos)` |
| 9  | Photo upload continues on individual failures (batch-safe) | VERIFIED | `SyncService.ts:232,244` — `failed++` and continues loop, never throws |
| 10 | useSync hook exposes incluirFotos params and photo progress state | VERIFIED | `useSync.ts` — `startSync(incluirFotos)`, `startPull(incluirFotos)`, returns `photoProgress` and `photoResult` |
| 11 | PlantationDetailHeader shows two buttons side by side: Descargar (info blue) and Subir (primary blue) with independent Incluir fotos checkboxes | VERIFIED | `PlantationDetailHeader.tsx` — `pullButton` with `colors.info`, `syncButton` with `colors.primary`, two `CheckboxRow` instances wired to `incluirFotosPull`/`incluirFotosPush` |
| 12 | SyncProgressModal shows uploading-photos and downloading-photos states with Spanish progress text | VERIFIED | `SyncProgressModal.tsx:63-85` — both states implemented with spinner, "Subiendo fotos..."/"Descargando fotos...", "N de M fotos" format |
| 13 | TreeListModal photo icon shows amber sync dot (pending) or dark blue dot (synced) visible to users | VERIFIED | `useTrees.ts:15` selects `fotoSynced: trees.fotoSynced`; `TreeListModal.tsx:14` has `fotoSynced?: boolean` in interface; lines 68-73 render `syncDot` (amber) and `syncDotSynced` (dark blue) conditionally; styles at lines 118-129 use `colors.stateFinalizada` and `colors.statSynced` |

**Score:** 13/13 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mobile/drizzle/0008_add_foto_synced.sql` | ALTER TABLE trees ADD foto_synced | VERIFIED | `ALTER TABLE \`trees\` ADD \`foto_synced\` integer DEFAULT false NOT NULL` |
| `mobile/drizzle/migrations.js` | Migration 0008 import | VERIFIED | `import m0008 from './0008_add_foto_synced.sql'` and m0008 in migrations object |
| `mobile/src/database/schema.ts` | fotoSynced column definition | VERIFIED | `fotoSynced: integer('foto_synced', { mode: 'boolean' }).notNull().default(false)` at line 46 |
| `mobile/src/services/PhotoService.ts` | resizeAndSaveToDocument function | VERIFIED | Exports `launchCamera`, `launchGallery`, `_resizeForTest`; uses `manipulateAsync` at 1600px |
| `mobile/src/repositories/TreeRepository.ts` | Photo sync helpers | VERIFIED | Exports `getTreesWithPendingPhotos`, `markPhotoSynced`; `updateTreePhoto` resets `fotoSynced: false` |
| `supabase/migrations/008_tree_photos_storage.sql` | Storage RLS policies | VERIFIED | Contains INSERT, SELECT, UPDATE policies for `tree-photos` bucket |
| `mobile/src/services/SyncService.ts` | uploadPendingPhotos and downloadPhotosForPlantation | VERIFIED | Both exported; `PhotoSyncProgress` type exported; internal `uploadPhotoToStorage` helper present |
| `mobile/src/hooks/useSync.ts` | Extended sync hook with photo states | VERIFIED | `SyncState` includes `uploading-photos` and `downloading-photos`; `startSync/startPull` accept `incluirFotos`; hook returns `photoProgress`, `photoResult` |
| `mobile/src/components/CheckboxRow.tsx` | Reusable checkbox + label component | VERIFIED | 20x20px box, `borderRadius.sm`, `borderWidth 1.5`, checked = `colors.primary` fill, `minHeight: 44` |
| `mobile/src/components/PlantationDetailHeader.tsx` | Two-button sync layout with photo toggles | VERIFIED | Descargar (colors.info) + Subir (colors.primary), each with CheckboxRow, `onStartPull(incluirFotos)` and `onStartSync(incluirFotos)` signatures |
| `mobile/src/components/SyncProgressModal.tsx` | Photo sync progress states | VERIFIED | uploading-photos and downloading-photos states implemented with correct Spanish copy and photoProgress prop |
| `mobile/src/hooks/useTrees.ts` | fotoSynced column in query select | VERIFIED | Line 15: `fotoSynced: trees.fotoSynced` added to db.select() call — gap closure confirmed |
| `mobile/src/components/TreeListModal.tsx` | Sync dot rendering on photo icon | VERIFIED | Line 14: `fotoSynced?: boolean` in TreeListItem; lines 68-73: amber dot (`!fotoSynced`) and blue dot (`fotoSynced`) in renderItem; lines 118-129: syncDot + syncDotSynced styles — gap closure confirmed |
| `mobile/src/screens/PlantationDetailScreen.tsx` | Wire incluirFotos + photo progress to modal | VERIFIED | Line 63 destructures `photoProgress, photoResult` from `useSync`; lines 124-125 pass `incluirFotos` to `startPull`/`startSync`; line 150 passes `photoProgress`/`photoResult` to `SyncProgressModal` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PhotoService.ts` | `expo-image-manipulator` | `manipulateAsync` import | WIRED | Line 3 imports `manipulateAsync, SaveFormat`; used in `resizeAndSaveToDocument` |
| `TreeRepository.ts` | `schema.ts` | `fotoSynced` column reference | WIRED | Lines 127, 157, 174 — all reference `trees.fotoSynced` from schema |
| `SyncService.ts` | `TreeRepository.ts` | `getTreesWithPendingPhotos + markPhotoSynced` | WIRED | Lines 11, 221, 245 — imported and called in `uploadPendingPhotos` |
| `SyncService.ts` | `supabase.storage` | `upload` and `createSignedUrl` calls | WIRED | Lines 200, 302 — `supabase.storage.from('tree-photos').upload()` and `.createSignedUrl()` |
| `useSync.ts` | `SyncService.ts` | `uploadPendingPhotos` and `downloadPhotosForPlantation` calls | WIRED | Lines 5-6 import both; called at lines 37, 60 |
| `PlantationDetailHeader.tsx` | `CheckboxRow.tsx` | import and render | WIRED | Line 11 imports `CheckboxRow`; lines 88-98 render two instances |
| `PlantationDetailScreen.tsx` | `useSync.ts` | `startSync(incluirFotos)` and `startPull(incluirFotos)` | WIRED | Lines 124-125 pass `incluirFotos` boolean from header callbacks to hook functions |
| `SyncProgressModal.tsx` | `useSync.ts` | `photoProgress` prop | WIRED | Line 16 accepts `photoProgress: PhotoSyncProgress | null`; used at lines 68-70, 80-82 |
| `useTrees.ts` | `schema.ts` | `trees.fotoSynced` column reference | WIRED | Line 15: `fotoSynced: trees.fotoSynced` — gap closure, was missing before plan 04 |
| `TreeListModal.tsx` | `useTrees.ts` | `fotoSynced` field in tree data | WIRED | `TreeListItem.fotoSynced?: boolean` (line 14) receives data from useTrees; renderItem at lines 68-73 consumes it |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SyncService.ts:uploadPendingPhotos` | `pending` array | `getTreesWithPendingPhotos(plantacionId)` — DB query with sincronizada + file:// filters | Yes — real SQLite query | FLOWING |
| `SyncService.ts:downloadPhotosForPlantation` | `remoteTrees` array | DB query on `trees` joined with `subgroups` | Yes — real SQLite query | FLOWING |
| `SyncProgressModal.tsx` | `photoProgress` | `setPhotoProgress` callback from `uploadPendingPhotos`/`downloadPhotosForPlantation` | Yes — updated per-iteration via `onProgress?.()` | FLOWING |
| `TreeListModal.tsx` | `fotoSynced` per tree | `useTrees` hook → `db.select({ fotoSynced: trees.fotoSynced })` | Yes — live SQLite query via useLiveData, returns actual boolean per row | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `fotoSynced` column in schema | `grep "foto_synced" mobile/src/database/schema.ts` | Found at line 46 | PASS |
| Migration 0008 SQL file exists | `test -f mobile/drizzle/0008_add_foto_synced.sql` | File exists with correct ALTER TABLE | PASS |
| m0008 in migrations.js | `grep "m0008" mobile/drizzle/migrations.js` | Found at import and in migrations object | PASS |
| manipulateAsync imported in PhotoService | `grep "manipulateAsync" mobile/src/services/PhotoService.ts` | Found — 3 occurrences | PASS |
| getTreesWithPendingPhotos exported | `grep "getTreesWithPendingPhotos" mobile/src/repositories/TreeRepository.ts` | Found — sincronizada + file:// filters in place | PASS |
| uploadPendingPhotos exported from SyncService | `grep "uploadPendingPhotos" mobile/src/services/SyncService.ts` | Found — 2 occurrences | PASS |
| uploading-photos in useSync SyncState | `grep "uploading-photos" mobile/src/hooks/useSync.ts` | Found — 3 occurrences | PASS |
| Descargar button in PlantationDetailHeader | `grep "Descargar" mobile/src/components/PlantationDetailHeader.tsx` | Found — 2 occurrences, `colors.info` background | PASS |
| uploading-photos in SyncProgressModal | `grep "uploading-photos" mobile/src/components/SyncProgressModal.tsx` | Found — with ActivityIndicator and "Subiendo fotos..." text | PASS |
| fotoSynced selected in useTrees | `grep "fotoSynced: trees.fotoSynced" mobile/src/hooks/useTrees.ts` | Found at line 15 — gap closure confirmed | PASS |
| fotoSynced in TreeListModal interface | `grep "fotoSynced" mobile/src/components/TreeListModal.tsx` | Found at lines 14, 68, 71 — interface + both conditional dot renders | PASS |
| syncDot styles in TreeListModal | `grep "syncDot\|stateFinalizada\|statSynced" mobile/src/components/TreeListModal.tsx` | Found at lines 69, 72, 118, 125, 127, 128 — styles and color tokens present | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IMG-01 | 12-01 | Photos resized to 1600px longest side at capture | SATISFIED | PhotoService.ts `resizeAndSaveToDocument` with `manipulateAsync`, landscape/portrait detection |
| IMG-02 | 12-01 | `fotoSynced` column tracks upload state; `updateTreePhoto` resets it | SATISFIED | schema.ts, migration 0008, TreeRepository.ts `updateTreePhoto` |
| IMG-03 | 12-02 | Push flow uploads pending photos after SubGroup sync | SATISFIED | `uploadPendingPhotos` in SyncService, called by useSync `startSync` |
| IMG-04 | 12-02 | Pull flow downloads remote photos to local storage | SATISFIED | `downloadPhotosForPlantation` in SyncService, called by useSync `startPull` |
| IMG-05 | 12-03 | Descargar/Subir two-button layout with independent Incluir fotos checkboxes | SATISFIED | PlantationDetailHeader + CheckboxRow |
| IMG-06 | 12-03 | SyncProgressModal shows photo sync progress states | SATISFIED | uploading-photos + downloading-photos states in SyncProgressModal |
| IMG-07 | 12-01 & 12-04 | TreeListModal photo icon shows fotoSynced sync state dot indicator | SATISFIED | useTrees.ts selects fotoSynced; TreeListModal.tsx interface + renderItem + styles all implemented — gap closed by plan 04 |

**Note on REQUIREMENTS.md traceability:** IMG-01 through IMG-07 are referenced in ROADMAP.md and plan files but have no entries in `.planning/REQUIREMENTS.md`'s Traceability table. This is a documentation gap only — implementation is complete. All requirements are effectively documented through CONTEXT.md decisions D-01 to D-17.

---

## Anti-Patterns Found

No blockers remain. The single blocker from the initial verification (orphaned TreeRow / no sync dot in TreeListModal) has been resolved by plan 04.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `mobile/src/components/TreeRow.tsx` | entire file | Component correctly implements sync dot pattern but is never imported anywhere | Info | No user impact — TreeListModal now has its own sync dot implementation. TreeRow.tsx can be cleaned up or repurposed later. |

---

## Human Verification Required

### 1. Photo Resize at Capture

**Test:** Open app, navigate to a tree, attach a photo via camera.
**Expected:** Photo file in `Paths.document/photos/` is JPEG with longest side <= 1600px.
**Why human:** Cannot run image capture or read file metadata without a live device.

### 2. Sync Push Photo Upload Progress

**Test:** Have a tree with a local photo (amber sync dot should now appear in TreeListModal). Tap "Subir" with "Incluir fotos" checked.
**Expected:** After SubGroup sync completes, modal transitions to "Subiendo fotos..." with "N de M fotos" counter. On completion, result shows "X fotos subidas correctamente". Tree sync dot changes from amber to dark blue.
**Why human:** Requires live Supabase Storage bucket and real network sync.

### 3. Sync Pull Photo Download Progress

**Test:** Pull from server where another user has synced trees with photos. Tap "Descargar" with "Incluir fotos" checked.
**Expected:** Modal shows "Actualizando datos..." then "Descargando fotos..." with progress. Photos appear locally for the trees.
**Why human:** Requires server-side photo data and real device download.

### 4. Incluir fotos unchecked — no photo step

**Test:** Uncheck "Incluir fotos" on either button. Run sync or pull.
**Expected:** Modal never transitions to a photo state. Sync/pull completes with only SubGroup data.
**Why human:** Requires device interaction with the sync flow.

### 5. Amber dot visible on unsynced photo tree

**Test:** Assign a photo to a tree (fotoSynced will be false). Open the tree list modal.
**Expected:** The image icon (Ionicons "image") for that tree shows a small amber dot at its top-right corner.
**Why human:** Requires live device rendering to confirm absolute-positioned 8px circle is visible and correctly positioned over the icon.

### 6. Dark blue dot visible on synced photo tree

**Test:** Complete a push sync for a tree with a photo. Open the tree list modal.
**Expected:** After `markPhotoSynced` executes, the dot changes from amber to dark blue on the next render.
**Why human:** Requires completed sync cycle + live device rendering to confirm state transition.

---

## Gap Closure Summary

**One gap was present after initial verification:** `TreeRow.tsx` implemented the sync dot correctly but was never imported anywhere. `TreeListModal.tsx` — the actual component rendered to users — had no `fotoSynced` awareness.

**Plan 04 closed the gap with two targeted changes:**
1. `mobile/src/hooks/useTrees.ts` — added `fotoSynced: trees.fotoSynced` to the `db.select()` call so the boolean flows from SQLite through the hook to consumers.
2. `mobile/src/components/TreeListModal.tsx` — added `fotoSynced?: boolean` to `TreeListItem` interface, added conditional amber/blue sync dot JSX inside the `item.fotoUrl` branch, and added `syncDot`/`syncDotSynced` styles matching the `TreeRow.tsx` pattern exactly (8px, absolute, top -2, right -2, borderRadius 4).

All 13 observable truths now pass automated verification. The remaining 6 human verification items cover runtime behaviors that require a live device and network.

---

_Verified: 2026-04-12T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
