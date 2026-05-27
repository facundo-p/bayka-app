import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { notifyDataChanged } from '../../database/liveQuery';
import { syncLog } from '../../utils/syncLogger';
import { SyncGroupResult, SyncProgress, GlobalSyncProgress } from './types';
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
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncGroupResult[]> {
  await runGlobalPreSteps();

  try {
    await pullFromServer(plantacionId);
  } catch (e) {
    syncLog.error('Pull failed:', e);
  }

  // D-16-13: push parcelas BEFORE groups (FK ordering).
  try {
    const parcelaResults = await uploadSyncableParcelas(plantacionId);
    const failed = parcelaResults.filter(r => !r.success).length;
    if (failed > 0) {
      syncLog.info(`Push parcelas: ${failed}/${parcelaResults.length} failed; groups dependientes saltarán`);
    }
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
): Promise<Array<{ plantationId: string; plantationName: string; results: SyncGroupResult[] }>> {
  await runGlobalPreSteps();

  const localPlantations = await db.select({ id: plantations.id, lugar: plantations.lugar }).from(plantations);
  const allResults: Array<{ plantationId: string; plantationName: string; results: SyncGroupResult[] }> = [];

  for (let i = 0; i < localPlantations.length; i++) {
    const p = localPlantations[i];
    onProgress?.({ plantationName: p.lugar, plantationDone: i, plantationTotal: localPlantations.length });

    try {
      await pullFromServer(p.id);
      // D-16-13: push parcelas antes que groups (FK).
      try {
        await uploadSyncableParcelas(p.id);
      } catch (e) {
        syncLog.error(`Push parcelas failed for "${p.lugar}":`, e);
      }
      const results = await uploadSyncableGroups(p.id, (subProgress) => {
        onProgress?.({
          plantationName: p.lugar,
          plantationDone: i,
          plantationTotal: localPlantations.length,
          subgroupProgress: subProgress,
        });
      });
      allResults.push({ plantationId: p.id, plantationName: p.lugar, results });
    } catch (e) {
      syncLog.error(`Failed for plantation "${p.lugar}":`, e);
      allResults.push({ plantationId: p.id, plantationName: p.lugar, results: [] });
    }
  }

  if (incluirFotos) {
    for (const p of localPlantations) {
      try {
        await uploadPendingPhotos(p.id);
        await downloadPhotosForPlantation(p.id);
      } catch (e) {
        syncLog.error(`Photo sync failed for "${p.lugar}":`, e);
      }
    }
  }

  notifyDataChanged();
  return allResults;
}
