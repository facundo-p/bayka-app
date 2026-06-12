import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { sql } from 'drizzle-orm';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { DownloadProgress, DownloadResult, DownloadPhaseProgress } from './types';
import { pullFromServer } from './pullService';
import { downloadPhotosForPlantation } from './photoService';
import { pullSpeciesFromServer } from './preSteps';

// ─── Download a single plantation from server ─────────────────────────────────

interface DownloadOptions {
  /** If true, download photos after data sync. Default false (data-only is fast). */
  includePhotos?: boolean;
  /** Per-phase progress callback. */
  onPhase?: (p: DownloadPhaseProgress) => void;
}

/**
 * Fila de plantations tal como llega del server (snake_case).
 * visible_in_app es opcional: tolera servers sin la migración que la agrega.
 */
export type ServerPlantationRow = {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
  visible_in_app?: boolean | null;
};

/**
 * Downloads a single plantation by upserting its row into local SQLite,
 * then calling pullFromServer to sync groups, species, and users.
 */
export async function downloadPlantation(
  serverPlantation: ServerPlantationRow,
  options: DownloadOptions = {},
): Promise<void> {
  const { includePhotos = false, onPhase } = options;

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
      // Ausente en la respuesta (server sin la columna) → visible.
      visibleInApp: serverPlantation.visible_in_app ?? true,
    })
    .onConflictDoUpdate({
      target: plantations.id,
      set: {
        estado: sql`excluded.estado`,
        pendingSync: false,
        lugarServer: serverPlantation.lugar,
        periodoServer: serverPlantation.periodo,
        visibleInApp: serverPlantation.visible_in_app ?? true,
      },
    });

  await pullFromServer(serverPlantation.id, onPhase);

  if (includePhotos) {
    try {
      await downloadPhotosForPlantation(serverPlantation.id, (p) => {
        onPhase?.({ phase: 'fotos', phaseDone: p.completed, phaseTotal: p.total });
      });
    } catch (e) {
      syncLog.error('Download: Photo download failed for plantation:', serverPlantation.id, e);
      // Non-fatal — plantation data is available, photos can be retried.
    }
  }
}

// ─── Batch download plantations ───────────────────────────────────────────────

/**
 * Downloads multiple plantations sequentially. Calls notifyDataChanged once
 * at the end to prevent render storms.
 *
 * Species catalog is pulled once at the start (before the loop) — trees rely
 * on local species rows for code/name resolution.
 */
export async function batchDownload(
  selected: ServerPlantationRow[],
  onProgress?: (progress: DownloadProgress) => void,
  options: { includePhotos?: boolean } = {},
): Promise<DownloadResult[]> {
  const { includePhotos = false } = options;
  const results: DownloadResult[] = [];

  const emitProgress = (
    plantationIndex: number,
    currentName: string,
    phase: DownloadPhaseProgress | null,
  ): void => {
    onProgress?.({
      plantationIndex,
      plantationTotal: selected.length,
      currentName,
      phase,
      total: selected.length,
      completed: plantationIndex - 1,
    });
  };

  // Initial event so the modal shows a state before the first plantation starts.
  if (selected.length > 0) {
    emitProgress(1, selected[0].lugar, { phase: 'species', phaseDone: 0, phaseTotal: 0 });
  }

  try {
    await pullSpeciesFromServer();
  } catch (e) {
    syncLog.error('Download: species catalog pull failed:', e);
  }

  for (let i = 0; i < selected.length; i++) {
    const plantation = selected[i];
    const plantationIndex = i + 1;
    emitProgress(plantationIndex, plantation.lugar, null);

    try {
      await downloadPlantation(plantation, {
        includePhotos,
        onPhase: (p) => emitProgress(plantationIndex, plantation.lugar, p),
      });
      results.push({ success: true, id: plantation.id, nombre: plantation.lugar });
    } catch (e) {
      syncLog.error(`Download: Failed for plantation "${plantation.lugar}" (${plantation.id}):`, e);
      results.push({ success: false, id: plantation.id, nombre: plantation.lugar });
    }
  }

  notifyDataChanged();

  return results;
}
