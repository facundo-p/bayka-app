import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { subgroups, trees } from '../../database/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { isRemoteUri, ensureFileUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';
import { getTreesWithPendingPhotos, markPhotoSynced } from '../../repositories/TreeRepository';
import { File as ExpoFile, Directory, Paths } from 'expo-file-system';
import { PhotoSyncProgress } from './types';

// ─── Photo upload helper (internal) ─────────────────────────────────────────

async function uploadPhotoToStorage(
  localUri: string,
  storagePath: string
): Promise<{ error: Error | null }> {
  try {
    const file = new ExpoFile(localUri);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from('tree-photos')
      .upload(storagePath, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    return { error: error ? new Error(error.message) : null };
  } catch (e: any) {
    return { error: e };
  }
}

// ─── Upload pending photos ───────────────────────────────────────────────────

/**
 * Uploads all pending photos for a plantation to Supabase Storage.
 * Per D-15: runs after SubGroup sync. Continues on individual failures (batch-safe).
 * Per D-12: stores relative storage path `plantations/{id}/trees/{id}.jpg` in Supabase trees table.
 * Per D-13: marks fotoSynced=true locally on success.
 */
export async function uploadPendingPhotos(
  plantacionId: string,
  onProgress?: (p: PhotoSyncProgress) => void
): Promise<{ uploaded: number; failed: number }> {
  const pending = await getTreesWithPendingPhotos(plantacionId);
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    onProgress?.({ total: pending.length, completed: i });
    const tree = pending[i];
    const storagePath = `plantations/${tree.plantacionId}/trees/${tree.id}.jpg`;

    const { error } = await uploadPhotoToStorage(tree.fotoUrl, storagePath);
    if (error) {
      syncLog.error(`Photo upload failed for tree ${tree.id}:`, error.message);
      failed++;
    } else {
      // Update Supabase trees table with relative storage path (D-12)
      const { error: updateError } = await supabase
        .from('trees')
        .update({ foto_url: storagePath })
        .eq('id', tree.id);

      if (updateError) {
        syncLog.error(`foto_url update failed for tree ${tree.id}:`, updateError.message);
        failed++;
      } else {
        await markPhotoSynced(tree.id);
        uploaded++;
      }
    }
  }

  onProgress?.({ total: pending.length, completed: pending.length });
  return { uploaded, failed };
}

// ─── Download photos helpers ─────────────────────────────────────────────────

async function getRemoteTreesForPlantation(
  plantacionId: string
): Promise<Array<{ id: string; fotoUrl: string; subgrupoId: string }>> {
  const allSubgroups = await db
    .select({ id: subgroups.id })
    .from(subgroups)
    .where(eq(subgroups.plantacionId, plantacionId));

  if (allSubgroups.length === 0) return [];

  const sgIds = allSubgroups.map(sg => sg.id);
  const allTrees = await db
    .select({ id: trees.id, fotoUrl: trees.fotoUrl, subgrupoId: trees.subgrupoId })
    .from(trees)
    .where(and(inArray(trees.subgrupoId, sgIds), isNotNull(trees.fotoUrl)));

  return allTrees.filter(t => isRemoteUri(t.fotoUrl)) as Array<{ id: string; fotoUrl: string; subgrupoId: string }>;
}

async function downloadSinglePhoto(
  tree: { id: string; fotoUrl: string },
  dir: InstanceType<typeof Directory>
): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from('tree-photos')
    .createSignedUrl(tree.fotoUrl, 3600);

  if (error || !data?.signedUrl) {
    syncLog.error(`Signed URL FAILED for tree ${tree.id}: ${error?.message ?? 'no signedUrl returned'}`);
    return false;
  }

  syncLog.info(`Signed URL OK for tree ${tree.id}, downloading...`);
  const destFile = new ExpoFile(dir, `photo_${tree.id}.jpg`);
  await ExpoFile.downloadFileAsync(data.signedUrl, destFile);
  syncLog.info(`Download OK for tree ${tree.id}: destUri=${destFile.uri}`);

  const localUri = ensureFileUri(destFile.uri);
  await db.update(trees).set({ fotoUrl: localUri, fotoSynced: true }).where(eq(trees.id, tree.id));
  return true;
}

/**
 * Downloads remote photos for a plantation to local storage.
 * Per D-16: runs during pull flow. Skips trees with local file:// URIs.
 * Updates local fotoUrl to local path and sets fotoSynced=true on success.
 */
export async function downloadPhotosForPlantation(
  plantacionId: string,
  onProgress?: (p: PhotoSyncProgress) => void
): Promise<{ downloaded: number; failed: number }> {
  const remoteTrees = await getRemoteTreesForPlantation(plantacionId);
  if (remoteTrees.length === 0) return { downloaded: 0, failed: 0 };

  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });

  syncLog.info(`Download photos: ${remoteTrees.length} remote trees found`);

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < remoteTrees.length; i++) {
    onProgress?.({ total: remoteTrees.length, completed: i });
    try {
      const success = await downloadSinglePhoto(remoteTrees[i], dir);
      if (success) downloaded++; else failed++;
    } catch (e: any) {
      syncLog.error(`Photo download EXCEPTION for tree ${remoteTrees[i].id}: ${e?.message}`);
      failed++;
    }
  }

  onProgress?.({ total: remoteTrees.length, completed: remoteTrees.length });
  return { downloaded, failed };
}
