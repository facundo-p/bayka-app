import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { SyncGroupResult, SyncParcelaResult, SyncProgress, GlobalSyncProgress } from './types';
import { runGlobalPreSteps } from './preSteps';
import { pullFromServer } from './pullService';
import { uploadSyncableGroups, uploadSyncableParcelas } from './pushService';
import { uploadPendingPhotos, downloadPhotosForPlantation } from './photoService';

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Orchestrates pull-then-push sync for a plantation.
 * 1. Refreshes auth session
 * 2. Pulls latest data from server
 * 3. Uploads each finalizada Group one by one
 * 4. Accumulates results (continues on failure)
 * 5. Notifies local data change once at the end
 */
export async function syncPlantation(
  plantacionId: string,
  onProgress?: (progress: SyncProgress) => void,
  onParcelaResults?: (parcelas: SyncParcelaResult[]) => void
): Promise<SyncGroupResult[]> {
  await runGlobalPreSteps();

  try {
    await pullFromServer(plantacionId);
  } catch (e) {
    syncLog.error('Pull failed:', e);
  }

  // D-16-13: push parcelas BEFORE groups (FK ordering).
  // Las fallas de parcela se surfacean vía onParcelaResults: de lo contrario el
  // único síntoma visible sería PARCELA_PENDING en los grupos, ocultando la
  // causa real (RLS, conflicto, red).
  try {
    const parcelaResults = await uploadSyncableParcelas(plantacionId);
    const failed = parcelaResults.filter(r => !r.success).length;
    if (failed > 0) {
      syncLog.info(`Push parcelas: ${failed}/${parcelaResults.length} failed; groups dependientes saltarán`);
    }
    onParcelaResults?.(parcelaResults);
  } catch (e) {
    syncLog.error('Push parcelas failed:', e);
  }

  const results = await uploadSyncableGroups(plantacionId, onProgress);
  notifyDataChanged();
  return results;
}

// ─── Global sync: all local plantations ──────────────────────────────────────

/**
 * Syncs all local plantations sequentially (pull+push per plantation).
 * Global pre-steps: species catalog, offline plantations, pending edits.
 * Optional photo sync across all plantations at the end.
 */
export async function syncAllPlantations(
  onProgress?: (info: GlobalSyncProgress) => void,
  incluirFotos: boolean = true
): Promise<{ plantationId: string; plantationName: string; results: SyncGroupResult[]; parcelas: SyncParcelaResult[] }[]> {
  await runGlobalPreSteps();

  const localPlantations = await db.select({ id: plantations.id, lugar: plantations.lugar }).from(plantations);
  const allResults: { plantationId: string; plantationName: string; results: SyncGroupResult[]; parcelas: SyncParcelaResult[] }[] = [];

  for (let i = 0; i < localPlantations.length; i++) {
    const plantation = localPlantations[i];
    onProgress?.({ plantationName: plantation.lugar, plantationDone: i, plantationTotal: localPlantations.length });

    try {
      await pullFromServer(plantation.id);
      // D-16-13: push parcelas antes que groups (FK). Surfaceamos sus fallas.
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
