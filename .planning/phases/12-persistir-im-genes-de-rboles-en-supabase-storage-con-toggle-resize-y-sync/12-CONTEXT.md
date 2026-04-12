# Phase 12: Persistir imágenes de árboles en Supabase Storage con toggle, resize y sync - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Upload tree photos from local device storage to Supabase Storage, with image resizing before upload, checkbox toggles to include/exclude photos during sync, download of other users' photos, and tracking of sync state per photo. The existing sync flow splits into two explicit actions (Descargar/Subir) with independent photo toggles.

</domain>

<decisions>
## Implementation Decisions

### Upload Timing & Trigger
- **D-01:** Replace single "Sincronizar" button with two buttons in the same line: **"Descargar"** (pull) and **"Subir"** (push)
- **D-02:** Each button has its own checkbox "Incluir fotos" — always ON by default, no persistence of toggle state
- **D-03:** Photo upload happens as part of the push flow (after SubGroup RPC succeeds), photo download as part of the pull flow
- **D-04:** If user skips photo upload (unchecks), photos remain local with `fotoSynced=false`. User can re-sync later with checkbox on — since SubGroups are already sincronizada, only pending photos upload

### Resize Strategy
- **D-05:** Resize to **1600px on the longest side**, JPEG compression
- **D-06:** Resize happens **at capture time** in PhotoService — replace the current `copyToDocument` with a resize+save operation. No additional step; the saved file is already optimized
- **D-07:** Resize applies to all photos equally (N/N and optional tree photos)

### Toggle Behavior
- **D-08:** Checkbox "Incluir fotos" always starts **ON** by default — no per-plantation or global persistence
- **D-09:** Two independent checkboxes: one for Descargar (pull photos), one for Subir (push photos)

### Server Storage & URL Mapping
- **D-10:** Supabase Storage bucket: `tree-photos` (private, RLS-protected)
- **D-11:** Path structure: `plantations/{plantationId}/trees/{treeId}.jpg`
- **D-12:** `foto_url` column stores **relative path** (e.g., `plantations/abc-123/trees/def-456.jpg`), not full URL. Resolve to full URL at display time via `supabase.storage.from('tree-photos').createSignedUrl(path)`
- **D-13:** New boolean column `fotoSynced` on local `trees` table to track which photos have been uploaded. Set to `true` after successful upload
- **D-14:** Bucket access: **private with RLS** — only authenticated users from the same organization can access. Requires signed URLs for download

### Sync Flow Changes
- **D-15:** Push flow: after syncing SubGroups, iterate trees with `fotoUrl != null AND fotoSynced = false`, upload each photo file to Storage, update `foto_url` in Supabase trees table with relative path, mark local `fotoSynced = true`
- **D-16:** Pull flow: when downloading trees from server, if tree has `foto_url` (remote path) and local file doesn't exist, download from Storage to `Paths.document/photos/` and set local `fotoUrl` to the local file path
- **D-17:** Progress UI: current SubGroup sync progress stays the same. Photo upload/download shows separate progress: "Subiendo fotos... 3/15" or "Descargando fotos... 7/20"

### Claude's Discretion
- Image manipulation library choice (expo-image-manipulator, sharp, etc.)
- RLS policy specifics for the tree-photos bucket
- Error handling strategy for partial photo upload failures (continue batch, retry logic)
- Local photo cleanup strategy (when to delete local copies of already-synced photos, if ever)
- Supabase migration for `fotoSynced` column and any schema changes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Photo System (current)
- `mobile/src/services/PhotoService.ts` — Current photo capture with copyToDocument (resize will replace this)
- `mobile/src/hooks/usePhotoCapture.ts` — Hook wrapping PhotoService for screens
- `mobile/src/hooks/usePhotoPicker.ts` — Camera/gallery modal picker

### Sync System (current)
- `mobile/src/services/SyncService.ts` — syncPlantation orchestrator, pullFromServer, uploadSubGroup, batchDownload
- `mobile/src/hooks/useSync.ts` — Sync hook used by screens
- `mobile/src/repositories/SubGroupRepository.ts` — getSyncableSubGroups, markAsSincronizada

### Data Layer
- `mobile/src/database/schema.ts` — Trees table with `fotoUrl` column (line 45)
- `mobile/src/repositories/TreeRepository.ts` — updateTreePhoto function
- `mobile/src/supabase/client.ts` — Supabase client (will need storage access)

### UI Integration Points
- `mobile/src/screens/TreeRegistrationScreen.tsx` — Where photos are captured during registration
- `mobile/src/components/TreeRow.tsx` — Displays photo indicator/thumbnail
- `mobile/src/components/PhotoViewerModal.tsx` — Full photo viewer

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PhotoService.ts`: Already handles camera/gallery capture with `copyToDocument` — resize will modify this function
- `SyncService.ts`: Has established pull-then-push pattern, progress callbacks, error accumulation — photo sync follows same patterns
- `useSync` hook: Manages sync state and progress UI — needs extension for photo progress
- `TreeRepository.updateTreePhoto`: Already updates `fotoUrl` on a tree record

### Established Patterns
- Sync uses `onProgress` callbacks with `{total, completed, currentName}` shape — photo sync should match
- Error handling: continue-on-failure with error accumulation (SyncSubGroupResult pattern)
- File storage: `Paths.document/photos/` directory with `photo_{timestamp}.jpg` naming
- Supabase operations: upsert with `onConflictDoUpdate`, idempotent design

### Integration Points
- `syncPlantation()` in SyncService needs to split into separate pull/push or expose both
- PlantationDetailScreen sync button needs to become two buttons
- Schema migration needed for `fotoSynced` column on trees table
- Supabase migration needed for Storage bucket + RLS policies

</code_context>

<specifics>
## Specific Ideas

- Two buttons (Descargar/Subir) side by side in the same line — visually balanced
- Progress messages in Spanish: "Subiendo fotos... 3/15", "Descargando fotos... 7/20"
- Photo sync is a second pass after SubGroup sync — not interleaved

</specifics>

<deferred>
## Deferred Ideas

### Phase 13: Sync Redesign (new phase to create)
- Eliminate "sincronizado" as a state — make it a visual indicator only
- Allow reopening and editing synchronized SubGroups
- Sync button on PlantationCard (instead of inside detail screen)
- Admins can open and edit SubGroups from other users
- Track `ultimoEditor` on subgroups (who last edited)
- Allow sync of SubGroups with unresolved N/N (for remote species identification by another user)
- Sync activa (open) SubGroups — not just finalizados
- Conflict resolution for concurrent edits on synced data

</deferred>

---

*Phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync*
*Context gathered: 2026-04-12*
