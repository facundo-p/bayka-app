import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { SyncGroupResult, SyncParcelaResult, SyncPlantationResult, SyncProgress, GlobalSyncProgress, DownloadPhaseProgress, PhotoSyncProgress, PullResult, PHOTO_PHASE, esPullSinDatos } from './types';
import { ensureServerSession } from './sessionGuard';
import { runGlobalPreSteps } from './preSteps';
import { pullFromServer } from './pullService';
import { pushBorrados, uploadSyncableGroups, uploadSyncableParcelas } from './pushService';
import { uploadPendingPhotos, downloadPhotosForPlantation } from './photoService';
import { marcandoActividadDeSync } from './syncActivityStore';
import { relanzarSiEsCancelacion } from './cancelacion';
import { REINTENTA_TODAS, conRegistroDeVarados } from './pendientesVarados';

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
  /**
   * El pull falló (red, timeout). El push sigue igual —subir lo que el técnico
   * cargó vale más que el pull— pero sin avisar, la UI dice "Datos actualizados"
   * para un pull que no bajó nada (#451).
   */
  onPullError?: (error: unknown) => void;
}

/** Orquesta pull-then-push de una plantación: refresca sesión, pull, sube grupos finalizada uno por uno acumulando resultados (sigue ante fallas), notifica al final. */
async function correrSyncPlantation(
  plantacionId: string,
  callbacks: SyncPlantationCallbacks = {},
): Promise<SyncGroupResult[]> {
  const { onProgress, onPhotoProgress, onPhaseProgress, onParcelaResults, onPlantationResults, onPullResult, onPullError } = callbacks;
  // Aborta temprano si la sesión no puede autenticar writes (evita que RLS rechace como error de permisos confuso).
  await ensureServerSession();
  // runGlobalPreSteps pushea plantaciones offline; se surfacean sus fallas porque bloquean (FK) sus parcelas/grupos.
  const plantationResults = await runGlobalPreSteps();
  onPlantationResults?.(plantationResults);

  try {
    const pull = await pullFromServer(plantacionId, onPhaseProgress);
    onPullResult?.(pull);
    // Sin membresía o eliminada el push también lo rechaza el server: cortar acá
    // evita una lista de errores que tapan la causa real.
    if (esPullSinDatos(pull)) return [];
  } catch (e) {
    relanzarSiEsCancelacion(e);
    syncLog.error('Pull failed:', e);
    onPullError?.(e);
  } finally {
    onPhaseProgress?.(null);
  }

  // Los borrados primero: si el grupo que se borró todavía está en el server, el
  // push de abajo lo volvería a upsertear (#467).
  try {
    await pushBorrados(plantacionId);
  } catch (e) {
    syncLog.error('Push borrados failed:', e);
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
    relanzarSiEsCancelacion(e);
    syncLog.error('Push parcelas failed:', e);
  }
  onParcelaResults?.(parcelaResults);

  const results = await uploadSyncableGroups(plantacionId, onProgress, onPhotoProgress);
  notifyDataChanged();
  return results;
}

export interface ResultadoDePlantacion {
  plantationId: string;
  plantationName: string;
  results: SyncGroupResult[];
  parcelas: SyncParcelaResult[];
  /**
   * Resultado del pull, si terminó. Sin acceso o eliminada (#478) la plantación se
   * saltea entera, y la UI tiene que poder decir cuáles fueron.
   */
  pull?: PullResult;
  /**
   * La excepción que tumbó a esta plantación, si la hubo. Sin esto una corrida en
   * la que TODO falló llega a la UI con listas vacías, indistinguible de una en la
   * que no había nada que sincronizar, y el modal dice "completa" (#451).
   */
  fallo?: unknown;
}

type PlantacionLocal = { id: string; lugar: string };
type EmitirProgresoGlobal = (plantationName: string, plantationDone: number, extra?: Partial<GlobalSyncProgress>) => void;

/** Borrados, parcelas y grupos de una plantación, en ese orden (FK). */
async function pushDePlantacion(
  plantation: PlantacionLocal,
  i: number,
  emitir: EmitirProgresoGlobal,
): Promise<Pick<ResultadoDePlantacion, 'results' | 'parcelas'>> {
  try {
    await pushBorrados(plantation.id);
  } catch (e) {
    syncLog.error(`Push borrados failed for "${plantation.lugar}":`, e);
  }
  let parcelas: SyncParcelaResult[] = [];
  try {
    parcelas = await uploadSyncableParcelas(plantation.id);
  } catch (e) {
    relanzarSiEsCancelacion(e);
    syncLog.error(`Push parcelas failed for "${plantation.lugar}":`, e);
  }
  const results = await uploadSyncableGroups(
    plantation.id,
    (subProgress) => emitir(plantation.lugar, i, { subgroupProgress: subProgress }),
    (fotos) => emitir(plantation.lugar, i, { photoProgress: fotos, photoPhase: PHOTO_PHASE.uploading }),
  );
  return { results, parcelas };
}

async function syncDePlantacionEnGlobal(
  plantation: PlantacionLocal,
  i: number,
  emitir: EmitirProgresoGlobal,
): Promise<ResultadoDePlantacion> {
  const base = { plantationId: plantation.id, plantationName: plantation.lugar, results: [], parcelas: [] };
  try {
    const pull = await pullFromServer(plantation.id, (fase) => emitir(plantation.lugar, i, { phaseProgress: fase }));
    if (esPullSinDatos(pull)) {
      syncLog.info(`Sync global: "${plantation.lugar}" ${pull.estado}, se saltea`);
      return { ...base, pull };
    }
    return { ...base, pull, ...(await pushDePlantacion(plantation, i, emitir)) };
  } catch (e) {
    relanzarSiEsCancelacion(e);
    syncLog.error(`Failed for plantation "${plantation.lugar}":`, e);
    return { ...base, fallo: e };
  }
}

/** Subida y bajada de fotos al final de la corrida, salteando las que no tienen acceso o se eliminaron. */
async function syncFotosGlobal(
  localPlantations: PlantacionLocal[],
  resultados: ResultadoDePlantacion[],
  emitir: EmitirProgresoGlobal,
): Promise<void> {
  for (let i = 0; i < localPlantations.length; i++) {
    const plantation = localPlantations[i];
    const pull = resultados[i]?.pull;
    if (pull && esPullSinDatos(pull)) continue;
    try {
      await uploadPendingPhotos(plantation.id, (fotos) =>
        emitir(plantation.lugar, i, { photoProgress: fotos, photoPhase: PHOTO_PHASE.uploading }),
      );
      await downloadPhotosForPlantation(plantation.id, (fotos) =>
        emitir(plantation.lugar, i, { photoProgress: fotos, photoPhase: PHOTO_PHASE.downloading }),
      );
    } catch (e) {
      relanzarSiEsCancelacion(e);
      syncLog.error(`Photo sync failed for "${plantation.lugar}":`, e);
    }
  }
}

/** Sincroniza todas las plantaciones locales secuencialmente (pull+push c/u); pre-steps globales (catálogo, plantaciones offline, ediciones pendientes) + sync de fotos opcional al final. */
async function correrSyncAllPlantations(
  onProgress?: (info: GlobalSyncProgress) => void,
  incluirFotos: boolean = true,
  onPlantationResults?: (plantations: SyncPlantationResult[]) => void
): Promise<ResultadoDePlantacion[]> {
  await ensureServerSession();
  const plantationResults = await runGlobalPreSteps();
  onPlantationResults?.(plantationResults);

  const localPlantations = await db.select({ id: plantations.id, lugar: plantations.lugar }).from(plantations);
  const emitir: EmitirProgresoGlobal = (plantationName, plantationDone, extra = {}) => onProgress?.({
    plantationName,
    plantationDone,
    plantationTotal: localPlantations.length,
    ...extra,
  });

  const allResults: ResultadoDePlantacion[] = [];
  for (let i = 0; i < localPlantations.length; i++) {
    emitir(localPlantations[i].lugar, i);
    allResults.push(await syncDePlantacionEnGlobal(localPlantations[i], i, emitir));
  }
  if (incluirFotos) await syncFotosGlobal(localPlantations, allResults, emitir);

  notifyDataChanged();
  return allResults;
}

// El banner de actualización OTA no puede ofrecer reiniciar la app en medio de una
// sincronización: la marca la ponen los orquestadores, no el hook (#446).
// Lo que no pudo subir se registra al terminar la corrida (#638).
export const syncPlantation = marcandoActividadDeSync(
  (plantacionId: string, callbacks?: SyncPlantationCallbacks) =>
    conRegistroDeVarados(() => correrSyncPlantation(plantacionId, callbacks), { ids: [plantacionId] }),
);
export const syncAllPlantations = marcandoActividadDeSync(
  (onProgress?: (info: GlobalSyncProgress) => void, incluirFotos?: boolean, onPlantationResults?: (plantations: SyncPlantationResult[]) => void) =>
    conRegistroDeVarados(() => correrSyncAllPlantations(onProgress, incluirFotos, onPlantationResults), REINTENTA_TODAS),
);
