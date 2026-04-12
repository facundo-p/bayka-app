# Phase 12: Persistir imágenes de árboles en Supabase Storage con toggle, resize y sync — Research

**Researched:** 2026-04-12
**Domain:** React Native / Expo image processing + Supabase Storage + SQLite schema migration + Sync service refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace single "Sincronizar" button with two buttons in the same line: "Descargar" (pull) and "Subir" (push)
- **D-02:** Each button has its own checkbox "Incluir fotos" — always ON by default, no persistence of toggle state
- **D-03:** Photo upload happens as part of the push flow (after SubGroup RPC succeeds), photo download as part of the pull flow
- **D-04:** If user skips photo upload (unchecks), photos remain local with `fotoSynced=false`. User can re-sync later with checkbox on — since SubGroups are already sincronizada, only pending photos upload
- **D-05:** Resize to 1600px on the longest side, JPEG compression
- **D-06:** Resize happens at capture time in PhotoService — replace the current `copyToDocument` with a resize+save operation. No additional step; the saved file is already optimized
- **D-07:** Resize applies to all photos equally (N/N and optional tree photos)
- **D-08:** Checkbox "Incluir fotos" always starts ON by default — no per-plantation or global persistence
- **D-09:** Two independent checkboxes: one for Descargar (pull photos), one for Subir (push photos)
- **D-10:** Supabase Storage bucket: `tree-photos` (private, RLS-protected)
- **D-11:** Path structure: `plantations/{plantationId}/trees/{treeId}.jpg`
- **D-12:** `foto_url` column stores relative path (e.g., `plantations/abc-123/trees/def-456.jpg`), not full URL. Resolve to full URL at display time via `supabase.storage.from('tree-photos').createSignedUrl(path)`
- **D-13:** New boolean column `fotoSynced` on local `trees` table to track which photos have been uploaded. Set to `true` after successful upload
- **D-14:** Bucket access: private with RLS — only authenticated users from the same organization can access. Requires signed URLs for download
- **D-15:** Push flow: after syncing SubGroups, iterate trees with `fotoUrl != null AND fotoSynced = false`, upload each photo file to Storage, update `foto_url` in Supabase trees table with relative path, mark local `fotoSynced = true`
- **D-16:** Pull flow: when downloading trees from server, if tree has `foto_url` (remote path) and local file doesn't exist, download from Storage to `Paths.document/photos/` and set local `fotoUrl` to the local file path
- **D-17:** Progress UI: photo upload/download shows separate progress: "Subiendo fotos... 3/15" or "Descargando fotos... 7/20"

### Claude's Discretion

- Image manipulation library choice (expo-image-manipulator, sharp, etc.)
- RLS policy specifics for the tree-photos bucket
- Error handling strategy for partial photo upload failures (continue batch, retry logic)
- Local photo cleanup strategy (when to delete local copies of already-synced photos, if ever)
- Supabase migration for `fotoSynced` column and any schema changes

### Deferred Ideas (OUT OF SCOPE)

- Phase 13 sync redesign: eliminate "sincronizado" state, allow reopening synced SubGroups, sync button on PlantationCard, admin edits, `ultimoEditor` tracking, sync activa SubGroups, conflict resolution
</user_constraints>

---

## Summary

Phase 12 adds photo persistence to the existing tree registration workflow. It has four interconnected technical concerns: (1) image resizing at capture time via a new library, (2) a Drizzle schema migration to add `fotoSynced` boolean to the local `trees` table, (3) Supabase Storage upload/download integration in SyncService, and (4) a UI refactor replacing the single sync button with two-button layout plus photo toggle checkboxes.

The existing codebase is well-prepared for this phase. `SyncService.ts` already has separate `pullFromServer` and `syncPlantation` orchestrators. `useSync` hook already has `startSync` and `startPull` as separate callbacks. The `SyncProgressModal` extension pattern is straightforward — two new states (`uploading-photos`, `downloading-photos`) follow identical layout to existing states. The `PlantationDetailHeader` refactor is the largest UI change.

The key technical decision for Claude's Discretion is **`expo-image-manipulator` v13.1.7** (latest compatible with Expo SDK 54). It is not currently installed and must be added. For Supabase Storage uploads from React Native, the correct pattern uses `expo-file-system` v19's `File.arrayBuffer()` to read the local file as `ArrayBuffer`, then uploads as `Uint8Array` — the new file-system API (already in use in the project) supports this natively.

**Primary recommendation:** Install `expo-image-manipulator@~13.1.7`, replace `copyToDocument` with `resizeAndSaveToDocument`, add Drizzle migration 0008 for `fotoSynced`, create Supabase bucket + RLS migration 008, then extend SyncService with photo push/pull functions that follow existing batch/progress patterns.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-image-manipulator | ~13.1.7 | Resize image to 1600px longest side, JPEG compress | Only Expo-native image manipulation library; no native module setup; peer dep `expo: '*'` matches SDK 54 |
| @supabase/supabase-js | 2.101.0 (already installed) | Storage bucket upload/download/signed URLs | Already in project; Storage API included in supabase-js client |
| expo-file-system | 19.0.21 (already installed) | Read local file as ArrayBuffer for upload; download from signed URL | Already in project; new API has `File.arrayBuffer()` and `File.downloadFileAsync()` |
| drizzle-orm | 0.45.1 (already installed) | Schema migration for `fotoSynced` column | Already in project; migration pattern established |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @expo/vector-icons (Ionicons) | already installed | Replace emoji photo icons in TreeRow with `image-outline`/`image` | TreeRow photo indicator update |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-image-manipulator | sharp (npm) | sharp is Node.js-only, does not run on device — not viable |
| expo-image-manipulator | react-native-image-resizer | Requires native module rebuild, no managed Expo support |
| File.arrayBuffer() for upload | base64 + decode | atob/Uint8Array approach is equivalent; arrayBuffer() is cleaner and already in expo-file-system v19 API |
| File.downloadFileAsync() | fetch + write | downloadFileAsync handles redirect/retry and writes directly to destination File |

**Installation:**
```bash
npx expo install expo-image-manipulator
```

**Version verification:** Confirmed via `npm view expo-image-manipulator version` = `13.1.7` (latest stable, published 2025). Compatible with Expo SDK 54.0.33 (installed).

---

## Architecture Patterns

### Recommended Project Structure

New and modified files for this phase:

```
mobile/
├── src/
│   ├── services/
│   │   ├── PhotoService.ts          # MODIFIED: replace copyToDocument with resizeAndSave
│   │   └── SyncService.ts           # MODIFIED: add uploadPhotos(), downloadPhotos(), refactor syncPlantation
│   ├── repositories/
│   │   └── TreeRepository.ts        # MODIFIED: add markPhotoSynced(), getTreesWithPendingPhotos()
│   ├── database/
│   │   └── schema.ts                # MODIFIED: add fotoSynced column to trees table
│   ├── hooks/
│   │   └── useSync.ts               # MODIFIED: add incluirFotos params to startSync/startPull
│   └── components/
│       ├── SyncProgressModal.tsx    # MODIFIED: add uploading-photos / downloading-photos states
│       ├── PlantationDetailHeader.tsx  # MODIFIED: two-button layout + CheckboxRow
│       ├── TreeRow.tsx              # MODIFIED: Ionicons, fotoSynced dot indicator
│       └── CheckboxRow.tsx          # NEW: reusable checkbox + label component
├── drizzle/
│   ├── 0008_add_foto_synced.sql     # NEW: ALTER TABLE trees ADD foto_synced
│   ├── meta/_journal.json           # MODIFIED: add entry for migration 0008
│   └── migrations.js               # MODIFIED: import m0008
└── supabase/
    └── migrations/
        └── 008_tree_photos_storage.sql  # NEW: bucket creation + RLS policies
```

### Pattern 1: Image Resize at Capture Time

**What:** Replace `copyToDocument()` in PhotoService with `resizeAndSaveToDocument()` that calls `expo-image-manipulator` before saving.
**When to use:** Every photo capture (camera + gallery), for both N/N and optional tree photos.

```typescript
// Source: expo-image-manipulator v13 docs + existing PhotoService pattern
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

async function resizeAndSaveToDocument(tempUri: string): Promise<string> {
  const filename = `photo_${Date.now()}.jpg`;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  const destPath = new File(dir, filename).uri;

  const result = await manipulateAsync(
    tempUri,
    [{ resize: { width: 1600 } }],  // expo-image-manipulator scales height proportionally
    { compress: 0.85, format: SaveFormat.JPEG, base64: false }
  );
  // result.uri is a temp file; copy to permanent path
  const source = new File(result.uri);
  const dest = new File(destPath);
  source.copy(dest);
  return dest.uri;
}
```

Note: `expo-image-manipulator` `resize` with only `width` or only `height` specified scales proportionally — this correctly handles "1600px on longest side" only if the image is landscape. For portrait images, use `height: 1600`. To handle both orientations: read the image dimensions first or use a helper that picks the longer dimension.

**Longest-side approach:**
```typescript
// manipulateAsync with resize — to target longest side:
// Pass { width: 1600 } for landscape, { height: 1600 } for portrait
// Image info can be obtained from result.width/height of a first pass, 
// OR use ImagePicker result.assets[0].width/height (available in the picker result)
const asset = result.assets[0];
const isLandscape = asset.width >= asset.height;
const resize = isLandscape ? { width: 1600 } : { height: 1600 };
```

### Pattern 2: Supabase Storage Upload from React Native

**What:** Read local file as ArrayBuffer and upload to Supabase Storage bucket.
**When to use:** Push flow after SubGroup RPC succeeds, for each tree with `fotoSynced=false`.

```typescript
// Source: expo-file-system v19 File.arrayBuffer() + supabase-js storage.from().upload()
import { File } from 'expo-file-system';
import { supabase } from '../supabase/client';

async function uploadPhotoToStorage(
  localUri: string,
  storagePath: string   // e.g., 'plantations/abc-123/trees/def-456.jpg'
): Promise<{ error: Error | null }> {
  const file = new File(localUri);
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error } = await supabase.storage
    .from('tree-photos')
    .upload(storagePath, bytes, {
      contentType: 'image/jpeg',
      upsert: true,  // idempotent: re-upload if already exists (retry-safe)
    });

  return { error: error ?? null };
}
```

### Pattern 3: Supabase Storage Download to Local File

**What:** Create a signed URL for a remote path, then download it to local storage.
**When to use:** Pull flow when tree row has `foto_url` (remote path) and local file doesn't exist.

```typescript
// Source: supabase-js storage.createSignedUrl() + expo-file-system File.downloadFileAsync()
import { File, Directory, Paths } from 'expo-file-system';
import { supabase } from '../supabase/client';

async function downloadPhotoFromStorage(
  storagePath: string,  // relative path from trees table foto_url
  treeId: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('tree-photos')
    .createSignedUrl(storagePath, 3600);  // 1 hour expiry

  if (error || !data?.signedUrl) return null;

  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });

  const destFile = new File(dir, `photo_${treeId}.jpg`);
  await File.downloadFileAsync(data.signedUrl, destFile);
  return destFile.uri;
}
```

### Pattern 4: Drizzle Migration (established pattern from Phase 07/08)

**What:** Three-file update — new SQL file, updated journal, updated migrations.js.
**When to use:** Every schema change. CRITICAL: missing migrations.js update = silent splash hang.

```sql
-- drizzle/0008_add_foto_synced.sql
ALTER TABLE `trees` ADD `foto_synced` integer DEFAULT false NOT NULL;
```

```json
// drizzle/meta/_journal.json — add entry:
{
  "idx": 8,
  "version": "6",
  "when": 1744500000000,
  "tag": "0008_add_foto_synced",
  "breakpoints": true
}
```

```javascript
// drizzle/migrations.js — add:
import m0008 from './0008_add_foto_synced.sql';
// and in migrations object: m0008
```

### Pattern 5: SyncService Photo Push (follows existing batch pattern)

**What:** After all SubGroup RPCs complete, iterate trees with pending photos and upload.
**When to use:** End of push (Subir) flow, after `syncPlantation` loop, only if `incluirFotos=true`.

```typescript
// Follows existing SyncProgress + continue-on-failure pattern
export type PhotoSyncProgress = { total: number; completed: number };

export async function uploadPendingPhotos(
  plantacionId: string,
  onProgress?: (p: PhotoSyncProgress) => void
): Promise<{ uploaded: number; failed: number }> {
  // Query trees: fotoUrl != null AND fotoSynced = false, for this plantation's subgroups
  const pending = await getTreesWithPendingPhotos(plantacionId);
  let uploaded = 0; let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    onProgress?.({ total: pending.length, completed: i });
    const tree = pending[i];
    const storagePath = `plantations/${tree.plantacionIdRaw}/trees/${tree.id}.jpg`;
    
    const { error } = await uploadPhotoToStorage(tree.fotoUrl!, storagePath);
    if (error) {
      failed++;
    } else {
      // Update Supabase trees table foto_url with relative path
      await supabase.from('trees').update({ foto_url: storagePath }).eq('id', tree.id);
      // Mark local fotoSynced = true
      await markPhotoSynced(tree.id);
      uploaded++;
    }
  }
  return { uploaded, failed };
}
```

### Pattern 6: useSync Hook Extension

**What:** Add `incluirFotos` parameter to both `startSync` and `startPull`.
**When to use:** Called from PlantationDetailHeader with checkbox state.

```typescript
// Extended SyncState to include photo states
export type SyncState = 'idle' | 'syncing' | 'pulling' | 'uploading-photos' | 'downloading-photos' | 'done';

const startSync = useCallback(async (incluirFotos: boolean) => {
  setState('syncing');
  // ... existing SubGroup sync ...
  if (incluirFotos) {
    setState('uploading-photos');
    await uploadPendingPhotos(plantacionId, (p) => setPhotoProgress(p));
  }
  setState('done');
}, [plantacionId]);
```

### Pattern 7: Supabase RLS Policy for tree-photos bucket

**What:** Storage bucket policy restricting access to authenticated users of the same organization.
**When to use:** Supabase migration 008.

```sql
-- supabase/migrations/008_tree_photos_storage.sql
-- The bucket itself is created via Supabase dashboard or API, not SQL.
-- RLS policies on storage.objects:

CREATE POLICY "Authenticated users can upload tree photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can read tree photos from their org"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);
```

Note: The bucket `tree-photos` must be created in Supabase dashboard (or via `supabase storage create`) before policies apply. SQL migrations cannot create buckets — only manage policies on `storage.objects`.

### Anti-Patterns to Avoid

- **Reading `foto_url` as a full URL at storage time:** D-12 says store only relative path. Signed URLs are ephemeral (1h) and must be created at display time. Never store full signed URL in DB.
- **Uploading photos interleaved with SubGroup RPCs:** D-03 says photo upload happens AFTER SubGroup sync completes. Keep them as a second pass.
- **Assuming `fotoUrl` is a local path after pull:** After pull, `fotoUrl` on local trees received from server will be the relative storage path. The pull flow must detect this (does not start with `file://`) and download the file.
- **Skipping migrations.js update:** The project has a historical pitfall (Phase 01, feedback_drizzle_migrations.md) — updating only SQL + journal without migrations.js causes silent splash hang. All three files must be updated.
- **Using `quality: 0.7` in ImagePicker after adding expo-image-manipulator:** The picker's `quality` parameter does its own JPEG compression before the image is handed to the app. Remove picker `quality` override when resizing in PhotoService to avoid double-compression. Pass `quality: 1` (no picker compression) then compress in `manipulateAsync`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resizing to max dimension | Custom canvas/pixel math | `expo-image-manipulator` `manipulateAsync` with `resize` | Handles EXIF rotation, color profiles, JPEG re-encoding correctly |
| Signed URL generation | Manual JWT/HMAC construction | `supabase.storage.from('tree-photos').createSignedUrl(path, ttl)` | Security-sensitive; supabase-js handles auth headers automatically |
| File download to local path | Manual fetch + write loop | `File.downloadFileAsync(url, destFile)` from expo-file-system | Handles redirects, progress, retries; already the project file-system API |
| File-to-bytes for upload | Manual base64 decode | `file.arrayBuffer()` from expo-file-system v19 `File` class | Already installed; cleaner than base64 round-trip |

**Key insight:** expo-file-system v19's new object API (`File`, `Directory`, `Paths`) is already in use in `PhotoService.ts`. All three operations needed for this phase — copy, read-as-bytes, download — are available on the `File` class without additional libraries.

---

## Common Pitfalls

### Pitfall 1: Drizzle 3-file migration rule
**What goes wrong:** Developer adds `0008_add_foto_synced.sql` and updates `_journal.json` but forgets `migrations.js`. App builds successfully but hangs at splash screen on device.
**Why it happens:** `useMigrations` hook reads from `migrations.js` (the bundled import map), not from the filesystem. The SQL file is never executed.
**How to avoid:** Always update all three files atomically: SQL + journal + migrations.js. Verified in project lesson `feedback_drizzle_migrations.md`.
**Warning signs:** App passes all unit tests but hangs on device/emulator at splash.

### Pitfall 2: `foto_url` dual semantics — local path vs. remote path
**What goes wrong:** After pull, trees downloaded from server have `foto_url = 'plantations/abc/trees/def.jpg'` (relative storage path). Code that treats `fotoUrl` as a local `file://` path will fail to display the photo.
**Why it happens:** D-12 stores relative path in DB. After pull, the local tree row gets that remote path written to `fotoUrl`. The pull flow must detect remote paths and download them.
**How to avoid:** Use a convention: local paths start with `file://` (from expo-file-system), remote paths never do. Check `fotoUrl?.startsWith('file://')` to distinguish. In `pullFromServer`, after inserting/updating a tree with `foto_url`, check if it's a remote path and trigger download only when `incluirFotos=true`.
**Warning signs:** Photos appear broken in PhotoViewerModal for pulled trees.

### Pitfall 3: expo-image-picker `quality` + expo-image-manipulator double-compression
**What goes wrong:** Current `PhotoService.ts` uses `quality: 0.7` in both `launchCameraAsync` and `launchImageLibraryAsync`. If `manipulateAsync` is then called with `compress: 0.85`, JPEG artifacts compound from two compression passes.
**Why it happens:** JPEG compression is lossy and cumulative. Two separate compression passes at 0.7 and 0.85 produce worse quality than a single pass at ~0.6.
**How to avoid:** Set picker `quality: 1` (pass through uncompressed) and let `manipulateAsync` perform the sole compression with `compress: 0.85`.
**Warning signs:** Photos have visible blocking artifacts despite reasonable compression settings.

### Pitfall 4: Portrait vs. landscape resize
**What goes wrong:** `manipulateAsync({ resize: { width: 1600 } })` correctly caps landscape photos at 1600px width. But for a portrait photo (e.g., 1200×1600), it would upscale to 1600px width, producing a larger file.
**Why it happens:** D-05 says "1600px on the longest side." For portrait, the longest side is height.
**How to avoid:** Read `asset.width` and `asset.height` from the ImagePicker result (available as `result.assets[0].width/height`) to pick the correct dimension for resize.
**Warning signs:** Portrait photos are larger in file size after "resize."

### Pitfall 5: Supabase bucket creation via SQL migration
**What goes wrong:** Developer writes SQL to CREATE BUCKET in migration file. SQL migrations run on the Postgres schema, not on the Storage service. Bucket creation silently fails or throws.
**Why it happens:** Supabase Storage buckets are managed via the Storage API or dashboard, not via `CREATE TABLE` / raw SQL.
**How to avoid:** Create the `tree-photos` bucket via Supabase dashboard or CLI (`supabase storage create tree-photos`) before running RLS policy migrations. Document this as a manual setup step.
**Warning signs:** RLS policies apply but uploads return "bucket not found."

### Pitfall 6: `fotoSynced` not reset when photo is replaced
**What goes wrong:** User takes a photo, syncs (fotoSynced=true). User then replaces the photo via the picker. Old `fotoSynced=true` remains, so the new photo is never uploaded.
**Why it happens:** `updateTreePhoto` in TreeRepository only updates `fotoUrl`. It does not reset `fotoSynced`.
**How to avoid:** In `updateTreePhoto`, always reset `fotoSynced=false` whenever `fotoUrl` is updated to a new non-null value.
**Warning signs:** Replaced photos show synced indicator but remote storage still has old photo.

### Pitfall 7: Uploading photos for trees in non-sincronizada SubGroups
**What goes wrong:** Push flow uploads photos for ALL trees with `fotoSynced=false`, including trees in SubGroups that haven't been synced yet. Those trees don't exist on the server yet, so updating `foto_url` in Supabase trees table fails.
**Why it happens:** D-15 says upload photos after SubGroup RPC succeeds. But if SubGroup RPC fails, the trees are not on the server.
**How to avoid:** Photo upload query must filter to trees whose `subgrupoId` belongs to a subgroup now marked `sincronizada` (either just synced or already synced). Alternatively: only upload photos for trees in subgroups that just successfully synced in this session + all previously sincronizadas.

---

## Code Examples

### expo-image-manipulator resize (verified)

```typescript
// Source: expo-image-manipulator v13 public API
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// asset from ImagePicker result
const asset = result.assets[0];
const isLandscape = (asset.width ?? 0) >= (asset.height ?? 0);
const resize = isLandscape
  ? { width: 1600 }
  : { height: 1600 };

const manipulated = await manipulateAsync(
  asset.uri,
  [{ resize }],
  { compress: 0.85, format: SaveFormat.JPEG }
);
// manipulated.uri is the resized file (temp location)
```

### Supabase Storage upload from ArrayBuffer

```typescript
// Source: supabase-js v2 + expo-file-system v19
import { File } from 'expo-file-system';

const file = new File(localUri);
const arrayBuffer = await file.arrayBuffer();
const bytes = new Uint8Array(arrayBuffer);

const { data, error } = await supabase.storage
  .from('tree-photos')
  .upload(storagePath, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
```

### Supabase signed URL + download

```typescript
// Source: supabase-js v2 + expo-file-system v19
const { data } = await supabase.storage
  .from('tree-photos')
  .createSignedUrl(storagePath, 3600);

if (data?.signedUrl) {
  const dest = new File(Paths.document, 'photos', `photo_${treeId}.jpg`);
  await File.downloadFileAsync(data.signedUrl, dest);
  // dest.uri is the permanent local path
}
```

### Drizzle schema addition

```typescript
// src/database/schema.ts — trees table addition
export const trees = sqliteTable('trees', {
  // ... existing columns ...
  fotoSynced: integer('foto_synced', { mode: 'boolean' }).notNull().default(false),
});
```

### Detecting remote vs local fotoUrl

```typescript
// Use file:// prefix as the convention for local paths
function isLocalPath(url: string | null | undefined): boolean {
  return !!url && url.startsWith('file://');
}

function isRemotePath(url: string | null | undefined): boolean {
  return !!url && !url.startsWith('file://');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `copyToDocument` (raw file copy, no resize) | `resizeAndSaveToDocument` (manipulateAsync + copy) | Phase 12 | All new photos bounded to ~1600px; existing photos unchanged |
| Single "Sincronizar" button | Two buttons: "Descargar" + "Subir" with photo toggles | Phase 12 | Pull and push are independent user actions |
| `fotoUrl` = local path only | `fotoUrl` = local path (pre-sync) or remote relative path (received via pull) | Phase 12 | Must distinguish at display time to generate signed URL |
| expo-file-system legacy API (`FileSystem.copyAsync`) | New object API (`File`, `Directory`, `Paths`) | Phase 02 (already migrated) | Used throughout; `File.arrayBuffer()` enables upload without extra libraries |

**Deprecated/outdated:**
- `emoji photo icons in TreeRow ('🖼' / '📷')`: Replaced with Ionicons `image`/`image-outline` per UI-SPEC.
- `SyncState` type with values `'idle' | 'syncing' | 'pulling' | 'done'`: Extended to include `'uploading-photos' | 'downloading-photos'`.

---

## Open Questions

1. **Bucket creation timing**
   - What we know: SQL migrations cannot create Storage buckets; must use dashboard or CLI
   - What's unclear: Whether the bucket already exists in the Supabase project
   - Recommendation: Plan should include a Wave 0 task to create bucket manually and verify. Document as a prerequisite, not a code task.

2. **Plantation ID lookup for storage path**
   - What we know: D-11 path = `plantations/{plantationId}/trees/{treeId}.jpg`. The `plantationId` is a UUID. Trees in local DB have `subgrupoId` but the plantation UUID is accessible via the subgroup's `plantacionId`.
   - What's unclear: The most efficient DB join to get `plantationId` for each pending photo tree.
   - Recommendation: In `getTreesWithPendingPhotos(plantacionId)`, join trees → subgroups to get `subgroups.plantacionId`. This is a single join query, straightforward in Drizzle.

3. **What to do with trees pulled from server that have `foto_url` but download fails**
   - What we know: D-16 says download if local file doesn't exist. Failure handling is Claude's Discretion.
   - What's unclear: Should `fotoUrl` be set to the remote path (broken display) or left null on failure?
   - Recommendation: On failure, leave `fotoUrl` as the remote path (not null). This preserves the information and allows retry on next pull. Display layer checks `isLocalPath()` — if false and no signed URL available, show a "not downloaded" placeholder.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-image-manipulator | D-05 resize at capture | NOT INSTALLED | — | None — must install |
| @supabase/supabase-js Storage API | D-10, D-12, D-15, D-16 | Included | 2.101.0 | — |
| expo-file-system File.arrayBuffer() | Upload pattern | Available | 19.0.21 | — |
| expo-file-system File.downloadFileAsync() | Download pattern | Available | 19.0.21 | — |
| Supabase `tree-photos` bucket | D-10 | UNKNOWN — verify in dashboard | — | Must create before upload |
| Drizzle migration tooling | Schema change | Available | drizzle-kit 0.31.9 | — |

**Missing dependencies with no fallback:**
- `expo-image-manipulator` not installed — must run `npx expo install expo-image-manipulator` before implementing PhotoService resize.

**Missing dependencies with fallback:**
- Supabase bucket existence unknown — must verify/create in dashboard. Has no code fallback.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + jest-expo ~54 |
| Config file | `mobile/jest.config.js` (inferred from package.json `jest-expo` preset) |
| Quick run command | `cd mobile && npx jest tests/services/PhotoService.test.ts --no-coverage` |
| Full suite command | `cd mobile && npx jest --no-coverage` |

### Existing Test Coverage

| File | What it Tests | Relevant to Phase 12 |
|------|--------------|----------------------|
| `tests/services/PhotoService.test.ts` | launchCamera, launchGallery, copyToDocument | MUST UPDATE — copyToDocument replaced by resize+save |
| `tests/hooks/useSync.test.ts` | useSync hook state machine | MUST UPDATE — new states + incluirFotos param |
| `tests/sync/SyncService.test.ts` | syncPlantation, uploadSubGroup | MUST UPDATE/EXTEND — new photo upload/download functions |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Status |
|----------|-----------|-------------------|-------------|
| manipulateAsync called with correct resize for landscape/portrait | unit | `npx jest tests/services/PhotoService.test.ts` | UPDATE existing |
| resizeAndSaveToDocument returns permanent file URI | unit | `npx jest tests/services/PhotoService.test.ts` | UPDATE existing |
| fotoSynced column added via migration | unit | `npx jest tests/database/migrations.test.ts` | UPDATE existing |
| getTreesWithPendingPhotos returns correct trees | unit | `npx jest tests/repositories/TreeRepository.test.ts` | UPDATE existing |
| markPhotoSynced sets fotoSynced=true | unit | `npx jest tests/repositories/TreeRepository.test.ts` | UPDATE existing |
| uploadPendingPhotos iterates and marks synced | unit | `npx jest tests/sync/SyncService.test.ts` | EXTEND existing |
| uploadPendingPhotos continues on single failure | unit | `npx jest tests/sync/SyncService.test.ts` | NEW test case |
| downloadPhotosFromServer downloads only missing files | unit | `npx jest tests/sync/SyncService.test.ts` | NEW test case |
| updateTreePhoto resets fotoSynced to false | unit | `npx jest tests/repositories/TreeRepository.test.ts` | NEW test case |

### Wave 0 Gaps

None — existing test infrastructure (Jest, mocking patterns, jest-expo) covers all phase requirements. Tests for new functions follow the exact same mocking patterns as `PhotoService.test.ts` (expo-file-system constructor mocks) and `SyncService.test.ts` (supabase chain mocks). No new framework or config needed.

---

## Sources

### Primary (HIGH confidence)

- expo-file-system v19 source — `File.arrayBuffer()`, `File.downloadFileAsync()` — verified by reading installed package source at `mobile/node_modules/expo-file-system/src/FileSystem.ts`
- `npm view expo-image-manipulator version` — verified current version 13.1.7, peer dep `expo: '*'`
- Existing project codebase — SyncService.ts, PhotoService.ts, schema.ts, drizzle/migrations.js, theme.ts — read directly

### Secondary (MEDIUM confidence)

- supabase-js v2 Storage API — `storage.from().upload()`, `createSignedUrl()` — verified via official docs fetch + installed package version 2.101.0
- expo-image-manipulator resize with single dimension (width OR height) proportional scaling — standard behavior documented in expo docs, consistent with manipulator v13 description

### Tertiary (LOW confidence)

- Supabase RLS policies for storage.objects — example policy structure from docs; exact `WITH CHECK` conditions for organization-scoping require project-specific auth schema knowledge

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified installed versions, confirmed expo-image-manipulator not installed, upload/download API verified in source
- Architecture: HIGH — all patterns derived from reading existing project code; follows established patterns
- Pitfalls: HIGH for known issues (drizzle 3-file rule from project lessons, fotoUrl dual semantics from decisions, double-compression from image processing knowledge), MEDIUM for pitfall 7 (upload ordering edge case)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable libraries, 30-day validity)
