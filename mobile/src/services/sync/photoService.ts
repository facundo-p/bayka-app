import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { groups, trees } from '../../database/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { isRemoteUri, ensureFileUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';
import { getTreesWithPendingPhotos, markPhotoSynced } from '../../repositories/TreeRepository';
import { File as ExpoFile, Directory, Paths } from 'expo-file-system';
import { PhotoSyncProgress } from './types';
import { uploadPhotoToStorage } from './storageUpload';
import { conLimiteDeConcurrencia, FOTOS_EN_PARALELO } from './concurrencia';
import { abortarSiCancelado, esCancelacion, relanzarSiEsCancelacion } from './cancelacion';
import { TIMEOUT_MS, TimeoutError } from '../../supabase/fetchConTimeout';
import { conReloj } from '../../utils/conReloj';
import { marcandoActividadDeSync } from './syncActivityStore';

// ─── Upload pending photos ───────────────────────────────────────────────────

/**
 * Resultado de mover una foto. `bytes` y `ok` van separados a propósito: un driver
 * que no informa el tamaño —o un archivo de 0 bytes— no puede hacer que una
 * transferencia exitosa cuente como fallida (#450).
 */
type Transferencia = { ok: boolean; bytes: number };

const FALLO: Transferencia = { ok: false, bytes: 0 };

/** Derivado de la query, no escrito a mano: si el repositorio cambia de forma, esto no queda desfasado. */
type ArbolConFotoPendiente = Awaited<ReturnType<typeof getTreesWithPendingPhotos>>[number];

/** Sube la foto a Storage y deja `foto_url` apuntando al path relativo. */
async function uploadSinglePhoto(tree: ArbolConFotoPendiente): Promise<Transferencia> {
  // Path con parcela: parcela es obligatoria en groups (#90).
  const storagePath = `plantations/${tree.plantacionId}/parcelas/${tree.parcelaId}/trees/${tree.id}.jpg`;

  const { error, bytes } = await uploadPhotoToStorage(tree.fotoUrl, storagePath);
  if (error) {
    syncLog.error(`Photo upload failed for tree ${tree.id}:`, error.message);
    return FALLO;
  }

  // Update Supabase trees table with relative storage path.
  const { error: updateError } = await supabase
    .from('trees')
    .update({ foto_url: storagePath })
    .eq('id', tree.id);
  if (updateError) {
    syncLog.error(`foto_url update failed for tree ${tree.id}:`, updateError.message);
    return FALLO;
  }

  await markPhotoSynced(tree.id);
  return { ok: true, bytes };
}

/**
 * Uploads all pending photos for a plantation to Supabase Storage.
 * Runs after Group sync; continues on individual failures (batch-safe).
 * Stores relative storage path `plantations/{id}/trees/{id}.jpg` in the Supabase trees table.
 * Marks fotoSynced=true locally on success.
 */
async function correrUploadPendingPhotos(
  plantacionId: string,
  onProgress?: (p: PhotoSyncProgress) => void
): Promise<{ uploaded: number; failed: number }> {
  const pending = await getTreesWithPendingPhotos(plantacionId);
  // Sin pendientes no se emite nada: un `{ total: 0, completed: 0 }` es truthy y
  // hacía que el modal saltara a "Subiendo fotos... 0 de 0" (#447).
  if (pending.length === 0) return { uploaded: 0, failed: 0 };

  const inicio = Date.now();
  let uploaded = 0;
  let failed = 0;
  let bytes = 0;
  onProgress?.({ total: pending.length, completed: 0, bytes: 0, desde: inicio });

  await conLimiteDeConcurrencia(pending, FOTOS_EN_PARALELO, async (tree) => {
    abortarSiCancelado();
    const subida = await subirFotoSinCortarLaTanda(tree);
    if (subida.ok) uploaded++; else failed++;
    bytes += subida.bytes;
    // Completadas, no índice del loop: con N fotos en vuelo el índice retrocede.
    onProgress?.({ total: pending.length, completed: uploaded + failed, bytes, desde: inicio });
  });

  syncLog.info(`Upload fotos: ${uploaded} ok, ${failed} fallidas, ${bytes} bytes en ${Date.now() - inicio}ms`);
  return { uploaded, failed };
}

/** Una excepción cuenta la foto como fallida sin cortar la tanda; una cancelación sí la corta (#502). */
async function subirFotoSinCortarLaTanda(tree: ArbolConFotoPendiente): Promise<Transferencia> {
  try {
    return await uploadSinglePhoto(tree);
  } catch (e: any) {
    relanzarSiEsCancelacion(e);
    syncLog.error(`Photo upload EXCEPTION for tree ${tree.id}: ${e?.message}`);
    return FALLO;
  }
}

// ─── Download photos helpers ─────────────────────────────────────────────────

async function getRemoteTreesForPlantation(
  plantacionId: string
): Promise<Array<{ id: string; fotoUrl: string; grupoId: string }>> {
  const allGroups = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.plantacionId, plantacionId));

  if (allGroups.length === 0) return [];

  const sgIds = allGroups.map(sg => sg.id);
  const allTrees = await db
    .select({ id: trees.id, fotoUrl: trees.fotoUrl, grupoId: trees.groupId })
    .from(trees)
    .where(and(inArray(trees.groupId, sgIds), isNotNull(trees.fotoUrl)));

  return allTrees.filter(t => isRemoteUri(t.fotoUrl)) as Array<{ id: string; fotoUrl: string; grupoId: string }>;
}

async function downloadSinglePhoto(
  tree: { id: string; fotoUrl: string },
  dir: InstanceType<typeof Directory>
): Promise<Transferencia> {
  const { data, error } = await supabase.storage
    .from('tree-photos')
    .createSignedUrl(tree.fotoUrl, 3600);

  if (error || !data?.signedUrl) {
    syncLog.error(`Signed URL FAILED for tree ${tree.id}: ${error?.message ?? 'no signedUrl returned'}`);
    return FALLO;
  }

  syncLog.info(`Signed URL OK for tree ${tree.id}, downloading...`);
  const destFile = new ExpoFile(dir, `photo_${tree.id}.jpg`);
  await bajarConTimeout(data.signedUrl, destFile);
  syncLog.info(`Download OK for tree ${tree.id}: destUri=${destFile.uri}`);

  const localUri = ensureFileUri(destFile.uri);
  await db.update(trees).set({ fotoUrl: localUri, fotoSynced: true }).where(eq(trees.id, tree.id));
  // `size` ya lo tiene el archivo recién escrito: no es una lectura extra (#450).
  return { ok: true, bytes: destFile.size ?? 0 };
}

/**
 * `ExpoFile.downloadFileAsync` es la única transferencia que el fetch con timeout
 * no cubre: no pasa por el cliente de Supabase y sus `DownloadOptions` solo tienen
 * `headers` e `idempotent` — no aceptan AbortSignal (#451).
 *
 * Se corta con un reloj. La descarga nativa sigue su curso —no hay cómo pararla—
 * pero el archivo a medias que deje no molesta: el reintento va con
 * `idempotent: true` y lo sobreescribe (#452).
 */
async function bajarConTimeout(url: string, destino: InstanceType<typeof ExpoFile>): Promise<void> {
  await conReloj(
    // El nombre es determinístico y el default de `idempotent` es false: sin esto,
    // cualquier descarga previa que dejó el archivo —truncada a mitad, o completa pero
    // cortada antes del update de la base— hace fallar todo reintento con "file already
    // exists". Con la opción, el reintento re-descarga y sobreescribe (#452).
    ExpoFile.downloadFileAsync(url, destino, { idempotent: true }),
    TIMEOUT_MS.transferencia,
    () => new TimeoutError(destino.uri, TIMEOUT_MS.transferencia),
  );
}

/**
 * Downloads remote photos for a plantation to local storage.
 * Runs during pull flow; skips trees with local file:// URIs.
 * Updates local fotoUrl to local path and sets fotoSynced=true on success.
 */
async function correrDownloadPhotosForPlantation(
  plantacionId: string,
  onProgress?: (p: PhotoSyncProgress) => void
): Promise<{ downloaded: number; failed: number }> {
  const remoteTrees = await getRemoteTreesForPlantation(plantacionId);
  if (remoteTrees.length === 0) return { downloaded: 0, failed: 0 };

  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });

  syncLog.info(`Download photos: ${remoteTrees.length} remote trees found`);

  const inicio = Date.now();
  let downloaded = 0;
  let failed = 0;
  let bytes = 0;
  onProgress?.({ total: remoteTrees.length, completed: 0, bytes: 0, desde: inicio });

  await conLimiteDeConcurrencia(remoteTrees, FOTOS_EN_PARALELO, async (tree) => {
    abortarSiCancelado();
    try {
      const bajada = await downloadSinglePhoto(tree, dir);
      if (bajada.ok) downloaded++; else failed++;
      bytes += bajada.bytes;
    } catch (e: any) {
      // Una foto que falla —timeout incluido— no corta la tanda; una cancelación sí.
      if (esCancelacion(e)) throw e;
      syncLog.error(`Photo download EXCEPTION for tree ${tree.id}: ${e?.message}`);
      failed++;
    }
    // Completadas, no índice del loop: con N fotos en vuelo el índice retrocede.
    onProgress?.({ total: remoteTrees.length, completed: downloaded + failed, bytes, desde: inicio });
  });

  syncLog.info(`Download fotos: ${downloaded} ok, ${failed} fallidas, ${bytes} bytes en ${Date.now() - inicio}ms`);
  return { downloaded, failed };
}

// `useSync` las llama fuera de los orquestadores, y son la parte más larga del sync
// de una plantación: sin marcarlas, el banner ofrecería reiniciar justo ahí (#446).
export const uploadPendingPhotos = marcandoActividadDeSync(correrUploadPendingPhotos);
export const downloadPhotosForPlantation = marcandoActividadDeSync(correrDownloadPhotosForPlantation);
