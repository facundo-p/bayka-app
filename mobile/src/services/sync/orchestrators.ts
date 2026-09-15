import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { SyncGroupResult, SyncParcelaResult, SyncPlantationResult, SyncProgress, GlobalSyncProgress, DownloadPhaseProgress, PhotoSyncProgress, PullResult, PHOTO_PHASE, esSinAcceso } from './types';
import { ensureServerSession } from './sessionGuard';
import { runGlobalPreSteps } from './preSteps';
import { pullFromServer } from './pullService';
import { uploadSyncableGroups, uploadSyncableParcelas } from './pushService';
import { uploadPendingPhotos, downloadPhotosForPlantation } from './photoService';
import { marcandoActividadDeSync } from './syncActivityStore';

/**
 * Callbacks de una corrida de plantación. Objeto y no parámetros posicionales: ya son
 * cinco y el orden se volvió imposible de leer en el call site.
 */
export interface SyncPlantationCallbacks {
  /** Avance del push de grupos. */
  onProgress?: (progress: SyncProgress) => void;
  /** Fotos que se suben dentro de cada grupo del push. */
  onPhotoProgress?: (progress: PhotoSyncProgress) => void;
  /**
   * Fase del pull en curso (parcelas, grupos, árboles…). Recibe `null` cuando el
   * pull terminó por cualquier vía —incluida una excepción—, para que la UI no deje
   * congelada una fase que ya pasó.
   */
  onPhaseProgress?: (fase: DownloadPhaseProgress | null) => void;
  onParcelaResults?: (parcelas: SyncParcelaResult[]) => void;
  onPlantationResults?: (plantations: SyncPlantationResult[]) => void;
  onPullResult?: (resultado: PullResult) => void;
}

/** Orquesta pull-then-push de una plantación: refresca sesión, pull, sube grupos finalizada uno por uno acumulando resultados (sigue ante fallas), notifica al final. */
async function correrSyncPlantation(
  plantacionId: string,
  callbacks: SyncPlantationCallbacks = {},
): Promise<SyncGroupResult[]> {
  const { onProgress, onPhotoProgress, onPhaseProgress, onParcelaResults, onPlantationResults, onPullResult } = callbacks;
  // Aborta temprano si la sesión no puede autenticar writes (evita que RLS rechace como error de permisos confuso).
  await ensureServerSession();
  // runGlobalPreSteps pushea plantaciones offline; se surfacean sus fallas porque bloquean (FK) sus parcelas/grupos.
  const plantationResults = await runGlobalPreSteps();
  onPlantationResults?.(plantationResults);

  try {
    const pull = await pullFromServer(plantacionId, onPhaseProgress);
    onPullResult?.(pull);
    // Sin membresía el push también lo rechaza RLS: cortar acá evita una lista
    // de errores de permisos que tapan la causa real.
    if (esSinAcceso(pull)) return [];
  } catch (e) {
    syncLog.error('Pull failed:', e);
  } finally {
    onPhaseProgress?.(null);
  }

  // Push parcelas antes que groups (FK). Las fallas se surfacean vía onParcelaResults — si no, el
  // único síntoma sería PARCELA_PENDING en los grupos, ocultando la causa real (RLS, conflicto, red).
  let parcelaResults: SyncParcelaResult[] = [];
  try {
    parcelaResults = await uploadSyncableParcelas(plantacionId);
    const failed = parcelaResults.filter(r => !r.success).length;
    if (failed > 0) {
      syncLog.info(`Push parcelas: ${failed}/${parcelaResults.length} failed; groups dependientes saltarán`);
    }
  } catch (e) {
    syncLog.error('Push parcelas failed:', e);
  }
  onParcelaResults?.(parcelaResults);

  const results = await uploadSyncableGroups(plantacionId, onProgress, onPhotoProgress);
  notifyDataChanged();
  return results;
}

/** Sincroniza todas las plantaciones locales secuencialmente (pull+push c/u); pre-steps globales (catálogo, plantaciones offline, ediciones pendientes) + sync de fotos opcional al final. */
async function correrSyncAllPlantations(
  onProgress?: (info: GlobalSyncProgress) => void,
  incluirFotos: boolean = true,
  onPlantationResults?: (plantations: SyncPlantationResult[]) => void
): Promise<{ plantationId: string; plantationName: string; results: SyncGroupResult[]; parcelas: SyncParcelaResult[] }[]> {
  await ensureServerSession();
  const plantationResults = await runGlobalPreSteps();
  onPlantationResults?.(plantationResults);

  const localPlantations = await db.select({ id: plantations.id, lugar: plantations.lugar }).from(plantations);
  const allResults: { plantationId: string; plantationName: string; results: SyncGroupResult[]; parcelas: SyncParcelaResult[] }[] = [];

  const emitir = (
    plantationName: string,
    plantationDone: number,
    extra: Partial<GlobalSyncProgress> = {},
  ) => onProgress?.({
    plantationName,
    plantationDone,
    plantationTotal: localPlantations.length,
    ...extra,
  });

  for (let i = 0; i < localPlantations.length; i++) {
    const plantation = localPlantations[i];
    emitir(plantation.lugar, i);

    try {
      const pull = await pullFromServer(plantation.id, (fase) =>
        emitir(plantation.lugar, i, { phaseProgress: fase }),
      );
      if (esSinAcceso(pull)) {
        syncLog.info(`Sync global: "${plantation.lugar}" sin acceso, se saltea`);
        continue;
      }
      // Push parcelas antes que groups (FK). Surfaceamos sus fallas.
      let parcelaResults: SyncParcelaResult[] = [];
      try {
        parcelaResults = await uploadSyncableParcelas(plantation.id);
      } catch (e) {
        syncLog.error(`Push parcelas failed for "${plantation.lugar}":`, e);
      }
      const results = await uploadSyncableGroups(
        plantation.id,
        (subProgress) => emitir(plantation.lugar, i, { subgroupProgress: subProgress }),
        (fotos) => emitir(plantation.lugar, i, { photoProgress: fotos, photoPhase: PHOTO_PHASE.uploading }),
      );
      allResults.push({ plantationId: plantation.id, plantationName: plantation.lugar, results, parcelas: parcelaResults });
    } catch (e) {
      syncLog.error(`Failed for plantation "${plantation.lugar}":`, e);
      allResults.push({ plantationId: plantation.id, plantationName: plantation.lugar, results: [], parcelas: [] });
    }
  }

  if (incluirFotos) {
    for (let i = 0; i < localPlantations.length; i++) {
      const plantation = localPlantations[i];
      try {
        await uploadPendingPhotos(plantation.id, (fotos) =>
          emitir(plantation.lugar, i, { photoProgress: fotos, photoPhase: PHOTO_PHASE.uploading }),
        );
        await downloadPhotosForPlantation(plantation.id, (fotos) =>
          emitir(plantation.lugar, i, { photoProgress: fotos, photoPhase: PHOTO_PHASE.downloading }),
        );
      } catch (e) {
        syncLog.error(`Photo sync failed for "${plantation.lugar}":`, e);
      }
    }
  }

  notifyDataChanged();
  return allResults;
}

// El banner de actualización OTA no puede ofrecer reiniciar la app en medio de una
// sincronización: la marca la ponen los orquestadores, no el hook (#446).
export const syncPlantation = marcandoActividadDeSync(correrSyncPlantation);
export const syncAllPlantations = marcandoActividadDeSync(correrSyncAllPlantations);
