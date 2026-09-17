import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { deletePlantationLocally } from '../../repositories/PlantationRepository';
import { relanzarSiEsCancelacion } from './cancelacion';
import { eq, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { DownloadProgress, DownloadResult, DownloadPhaseProgress, DOWNLOAD_PHASE, esSinAcceso } from './types';
import { pullFromServer, webManagedFlags } from './pullService';
import { downloadPhotosForPlantation } from './photoService';
import { pullSpeciesFromServer } from './preSteps';
import { marcandoActividadDeSync } from './syncActivityStore';

interface DownloadOptions {
  /** If true, download photos after data sync. Default false (data-only is fast). */
  includePhotos?: boolean;
  /** Per-phase progress callback. */
  onPhase?: (p: DownloadPhaseProgress) => void;
}

/** Fila de plantations tal como llega del server (snake_case); los flags de la web son opcionales, toleran servers sin esas columnas. */
export type ServerPlantationRow = {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
  visible_in_app?: boolean | null;
  photo_capture_all_trees?: boolean | null;
};

/** Descarga una plantación: upsertea su fila en SQLite local, luego pullFromServer sincroniza groups/species/users. */
export async function downloadPlantation(
  serverPlantation: ServerPlantationRow,
  options: DownloadOptions = {},
): Promise<void> {
  const { includePhotos = false, onPhase } = options;

  // Una plantación que ya estaba local no se revierte si el pull falla: sus datos
  // viejos siguen siendo mejores que nada, y el pull es idempotente.
  const [yaEstabaLocal] = await db
    .select({ id: plantations.id })
    .from(plantations)
    .where(eq(plantations.id, serverPlantation.id));

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
      ...webManagedFlags(serverPlantation),
    })
    .onConflictDoUpdate({
      target: plantations.id,
      set: {
        estado: sql`excluded.estado`,
        pendingSync: false,
        lugarServer: serverPlantation.lugar,
        periodoServer: serverPlantation.periodo,
        ...webManagedFlags(serverPlantation),
      },
    });

  try {
    const pull = await pullFromServer(serverPlantation.id, onPhase);
    // Sin acceso no hay datos que bajar: que la descarga se reporte como fallida
    // en vez de "listo" con la plantación vacía.
    if (esSinAcceso(pull)) {
      throw new Error(`Sin acceso a la plantación ${serverPlantation.id}`);
    }
  } catch (e) {
    // Primero: cancelar una sync corta todo lo que pase por `fetchAllRows`,
    // incluida una descarga de catálogo en paralelo. Eso NO es un pull fallido y
    // no puede disparar el borrado (#451).
    relanzarSiEsCancelacion(e);
    // La fila se insertó con `pendingSync: false` antes del pull, así que una
    // plantación nueva cuyo pull falla queda en el listado como descargada y
    // vacía (#448). Se borra con lo que haya alcanzado a bajar.
    if (!yaEstabaLocal) {
      // El revert no puede pisar la causa real: si falla, se loguea aparte y se
      // propaga el error del pull, que es lo que hay que diagnosticar.
      try {
        await deletePlantationLocally(serverPlantation.id);
        syncLog.info('Download: pull falló, se revierte la plantación', serverPlantation.id);
      } catch (errorDelRevert) {
        syncLog.error('Download: no se pudo revertir la plantación', serverPlantation.id, errorDelRevert);
      }
    }
    throw e;
  }

  if (includePhotos) {
    try {
      await downloadPhotosForPlantation(serverPlantation.id, (p) => {
        onPhase?.({ phase: DOWNLOAD_PHASE.fotos, phaseDone: p.completed, phaseTotal: p.total });
      });
    } catch (e) {
      syncLog.error('Download: Photo download failed for plantation:', serverPlantation.id, e);
      // Non-fatal — plantation data is available, photos can be retried.
    }
  }
}

/**
 * Descarga varias plantaciones secuencialmente; notifyDataChanged una sola vez al final (evita
 * render storms). El catálogo de species se trae una vez al inicio — los árboles lo necesitan para resolver código/nombre.
 */
async function correrBatchDownload(
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
    emitProgress(1, selected[0].lugar, { phase: DOWNLOAD_PHASE.species, phaseDone: 0, phaseTotal: 0 });
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

// Escribe la DB local y baja fotos igual que una sync: cuenta como actividad (#446).
export const batchDownload = marcandoActividadDeSync(correrBatchDownload);
