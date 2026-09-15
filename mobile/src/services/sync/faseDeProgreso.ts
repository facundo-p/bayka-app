/**
 * Traduce una emisión de progreso global a la fase que tiene que mostrar el modal
 * (#447). Vive acá y no dentro del hook porque es una decisión de prioridad con
 * varios casos borde y, adentro de un callback, no habría forma de testearla.
 */
import { SYNC_STATE, PHOTO_PHASE } from './types';
import type { GlobalSyncProgress, SyncState, SyncProgress, PhotoSyncProgress, DownloadPhaseProgress } from './types';

export interface FaseDeProgreso {
  state: SyncState;
  photoProgress?: PhotoSyncProgress;
  subgroupProgress?: SyncProgress;
  phaseProgress?: DownloadPhaseProgress | null;
}

/**
 * Prioridad: fotos gana sobre grupos y grupos sobre pull, porque cada fase reemplaza
 * a la anterior dentro de una misma plantación. Un progreso de fotos vacío no cuenta:
 * `uploadPendingPhotos` puede cerrar en 0 y mostraría "Subiendo fotos... 0 de 0".
 */
export function faseDeProgresoGlobal(info: GlobalSyncProgress): FaseDeProgreso {
  if (info.photoProgress && info.photoProgress.total > 0) {
    return {
      state: info.photoPhase === PHOTO_PHASE.uploading
        ? SYNC_STATE.uploadingPhotos
        : SYNC_STATE.downloadingPhotos,
      photoProgress: info.photoProgress,
    };
  }
  if (info.subgroupProgress) {
    return { state: SYNC_STATE.pushing, subgroupProgress: info.subgroupProgress, phaseProgress: null };
  }
  if (info.phaseProgress) {
    return { state: SYNC_STATE.pulling, phaseProgress: info.phaseProgress };
  }
  return { state: SYNC_STATE.pulling };
}
