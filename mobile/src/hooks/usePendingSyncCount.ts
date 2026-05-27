import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from './useCurrentUserId';
import {
  countPendingGroups,
  countNNBlockedGroups,
  countPendingTreePhotos,
  countPendingParcelas,
} from '../queries/pendingSyncQueries';

/**
 * Returns live counts for sync-pending entities. Filtered by current user
 * (each user only sees their own pending groups).
 *
 * - pendingCount: total pending entities (groups + parcelas) for OrangeDot
 * - syncableCount: pendingCount minus N/N blocked groups (CTA gating)
 * - blockedByNN: finalizada groups blocked by unresolved N/N
 * - pendingPhotosCount: trees with local photo not yet uploaded
 * - pendingParcelasCount: parcelas with pending_sync=true (activas + tombstones)
 *
 * D-16-15 + Finding #10 PLAN-CHECK: las queries viven en
 * `queries/pendingSyncQueries.ts` (CLAUDE.md §9 — cero SQL en hooks).
 */
export function usePendingSyncCount(plantacionId?: string) {
  const userId = useCurrentUserId();

  const { data: pendingData } = useLiveData(
    () => countPendingGroups({ plantacionId, userId }),
    [plantacionId, userId]
  );

  const { data: nnBlockedData } = useLiveData(
    () => countNNBlockedGroups({ plantacionId, userId }),
    [plantacionId, userId]
  );

  const { data: pendingPhotosData } = useLiveData(
    () => countPendingTreePhotos({ plantacionId }),
    [plantacionId]
  );

  const { data: pendingParcelasData } = useLiveData(
    () => countPendingParcelas({ plantacionId }),
    [plantacionId]
  );

  const pendingGroupsCount = pendingData?.[0]?.cnt ?? 0;
  const blockedByNN = nnBlockedData?.[0]?.cnt ?? 0;
  const pendingParcelasCount = pendingParcelasData?.[0]?.cnt ?? 0;
  const pendingPhotosCount = pendingPhotosData?.[0]?.cnt ?? 0;

  // D-16-15: parcelas pendientes suman al contador global del OrangeDot.
  const pendingCount = pendingGroupsCount + pendingParcelasCount;
  const syncableCount = pendingGroupsCount - blockedByNN;

  return {
    pendingCount,
    syncableCount,
    blockedByNN,
    pendingPhotosCount,
    pendingParcelasCount,
  };
}
