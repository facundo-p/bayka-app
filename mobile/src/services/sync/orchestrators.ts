import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { SyncGroupResult, SyncParcelaResult, SyncPlantationResult, SyncProgress, GlobalSyncProgress } from './types';
import { ensureServerSession } from './sessionGuard';
import { runGlobalPreSteps } from './preSteps';
import { pullFromServer } from './pullService';
import { uploadSyncableGroups, uploadSyncableParcelas } from './pushService';
import { uploadPendingPhotos, downloadPhotosForPlantation } from './photoService';

/** Orquesta pull-then-push de una plantación: refresca sesión, pull, sube grupos finalizada uno por uno acumulando resultados (sigue ante fallas), notifica al final. */
export async function syncPlantation(
  plantacionId: string,
  onProgress?: (progress: SyncProgress) => void,
  onParcelaResults?: (parcelas: SyncParcelaResult[]) => void,
  onPlantationResults?: (plantations: SyncPlantationResult[]) => void
): Promise<SyncGroupResult[]> {
  // Aborta temprano si la sesión no puede autenticar writes (evita que RLS rechace como error de permisos confuso).
  await ensureServerSession();
  // runGlobalPreSteps pushea plantaciones offline; se surfacean sus fallas porque bloquean (FK) sus parcelas/grupos.
  const plantationResults = await runGlobalPreSteps();
  onPlantationResults?.(plantationResults);

  try {
    await pullFromServer(plantacionId);
  } catch (e) {
    syncLog.error('Pull failed:', e);
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

  const results = await uploadSyncableGroups(plantacionId, onProgress);
  notifyDataChanged();
  return results;
}

/** Sincroniza todas las plantaciones locales secuencialmente (pull+push c/u); pre-steps globales (catálogo, plantaciones offline, ediciones pendientes) + sync de fotos opcional al final. */
export async function syncAllPlantations(
  onProgress?: (info: GlobalSyncProgress) => void,
  incluirFotos: boolean = true,
  onPlantationResults?: (plantations: SyncPlantationResult[]) => void
): Promise<{ plantationId: string; plantationName: string; results: SyncGroupResult[]; parcelas: SyncParcelaResult[] }[]> {
  await ensureServerSession();
  const plantationResults = await runGlobalPreSteps();
  onPlantationResults?.(plantationResults);

  const localPlantations = await db.select({ id: plantations.id, lugar: plantations.lugar }).from(plantations);
  const allResults: { plantationId: string; plantationName: string; results: SyncGroupResult[]; parcelas: SyncParcelaResult[] }[] = [];

  for (let i = 0; i < localPlantations.length; i++) {
    const plantation = localPlantations[i];
    onProgress?.({ plantationName: plantation.lugar, plantationDone: i, plantationTotal: localPlantations.length });

    try {
      await pullFromServer(plantation.id);
      // Push parcelas antes que groups (FK). Surfaceamos sus fallas.
      let parcelaResults: SyncParcelaResult[] = [];
      try {
        parcelaResults = await uploadSyncableParcelas(plantation.id);
      } catch (e) {
        syncLog.error(`Push parcelas failed for "${plantation.lugar}":`, e);
      }
      const results = await uploadSyncableGroups(plantation.id, (subProgress) => {
        onProgress?.({
          plantationName: plantation.lugar,
          plantationDone: i,
          plantationTotal: localPlantations.length,
          subgroupProgress: subProgress,
        });
      });
      allResults.push({ plantationId: plantation.id, plantationName: plantation.lugar, results, parcelas: parcelaResults });
    } catch (e) {
      syncLog.error(`Failed for plantation "${plantation.lugar}":`, e);
      allResults.push({ plantationId: plantation.id, plantationName: plantation.lugar, results: [], parcelas: [] });
    }
  }

  if (incluirFotos) {
    for (const plantation of localPlantations) {
      try {
        await uploadPendingPhotos(plantation.id);
        await downloadPhotosForPlantation(plantation.id);
      } catch (e) {
        syncLog.error(`Photo sync failed for "${plantation.lugar}":`, e);
      }
    }
  }

  notifyDataChanged();
  return allResults;
}
