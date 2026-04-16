import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { sql } from 'drizzle-orm';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { DownloadProgress, DownloadResult } from './types';
import { pullFromServer } from './pullService';
import { downloadPhotosForPlantation } from './photoService';

// ─── Download a single plantation from server ─────────────────────────────────

/**
 * Downloads a single plantation by upserting its row into local SQLite,
 * then calling pullFromServer to sync subgroups, species, and users.
 *
 * Step 1: upsert the plantation row (onConflictDoUpdate to update estado)
 * Step 2: pullFromServer for subgroups, plantation_users, plantation_species
 */
export async function downloadPlantation(serverPlantation: {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
}): Promise<void> {
  // Step 1: Upsert plantation row using the same pattern as PlantationRepository
  await db
    .insert(plantations)
    .values({
      id: serverPlantation.id,
      organizacionId: serverPlantation.organizacion_id,
      lugar: serverPlantation.lugar,
      periodo: serverPlantation.periodo,
      estado: serverPlantation.estado,
      creadoPor: serverPlantation.creado_por,
      createdAt: serverPlantation.created_at,
      pendingSync: false,
      lugarServer: serverPlantation.lugar,
      periodoServer: serverPlantation.periodo,
    })
    .onConflictDoUpdate({
      target: plantations.id,
      set: {
        estado: sql`excluded.estado`,
        pendingSync: false,
        lugarServer: serverPlantation.lugar,
        periodoServer: serverPlantation.periodo,
      },
    });

  // Step 2: Pull related data (subgroups, plantation_users, plantation_species, trees)
  await pullFromServer(serverPlantation.id);

  // Step 3: Download photos from Storage to local device
  try {
    await downloadPhotosForPlantation(serverPlantation.id);
  } catch (e) {
    syncLog.error('Download: Photo download failed for plantation:', serverPlantation.id, e);
    // Non-fatal — plantation data is available, photos can be retried via "Descargar"
  }
}

// ─── Batch download plantations ───────────────────────────────────────────────

/**
 * Downloads multiple plantations one by one, accumulating results.
 * Continues on per-plantation error (does not abort the batch).
 * Calls notifyDataChanged ONCE after the entire loop.
 *
 * @param selected - Array of server plantation objects to download
 * @param onProgress - Optional progress callback called before each download
 * @returns Array of DownloadResult with success/failure per plantation
 */
export async function batchDownload(
  selected: Array<{
    id: string;
    organizacion_id: string;
    lugar: string;
    periodo: string;
    estado: string;
    creado_por: string;
    created_at: string;
  }>,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];

  for (let i = 0; i < selected.length; i++) {
    const plantation = selected[i];
    onProgress?.({ total: selected.length, completed: i, currentName: plantation.lugar });

    try {
      await downloadPlantation(plantation);
      results.push({ success: true, id: plantation.id, nombre: plantation.lugar });
    } catch (e) {
      syncLog.error(`Download: Failed for plantation "${plantation.lugar}" (${plantation.id}):`, e);
      results.push({ success: false, id: plantation.id, nombre: plantation.lugar });
    }
  }

  // ONCE — not inside loop (per Phase 03 decision: prevent render storm)
  notifyDataChanged();

  return results;
}
