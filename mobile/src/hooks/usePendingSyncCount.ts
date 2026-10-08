import { useLiveData } from '../database/liveQuery';
import { useQuienSube } from './useQuienSube';
import {
  countPendingGroups,
  countNNBlockedGroups,
  countPendingTreePhotos,
  countPendingParcelas,
} from '../queries/pendingSyncQueries';

/**
 * Conteos reactivos de entidades pendientes de sync. Grupos y fotos cuentan si
 * el sync del usuario actual los sube: un técnico, los suyos; un admin, todos.
 *
 * - pendingCount: total pendiente (grupos + parcelas + fotos) para el OrangeDot
 * - syncableCount: grupos pendientes menos los bloqueados por N/N (gating del CTA)
 * - blockedByNN: grupos finalizados bloqueados por N/N sin resolver
 * - pendingGroupsCount / pendingParcelasCount / pendingPhotosCount: desglose
 *   por entidad (parcelas incluyen tombstones pendientes)
 *
 * Issue #71: las fotos pendientes suman a pendingCount — antes el dot las
 * ignoraba y quedaba inconsistente con el trabajo pendiente real.
 */
export function usePendingSyncCount(plantacionId?: string) {
  const { userId, esAdmin } = useQuienSube();

  const { data: pendingData } = useLiveData(
    () => countPendingGroups({ plantacionId, userId, esAdmin }),
    [plantacionId, userId, esAdmin]
  );

  const { data: nnBlockedData } = useLiveData(
    () => countNNBlockedGroups({ plantacionId, userId, esAdmin }),
    [plantacionId, userId, esAdmin]
  );

  const { data: pendingPhotosData } = useLiveData(
    () => countPendingTreePhotos({ plantacionId, userId, esAdmin }),
    [plantacionId, userId, esAdmin]
  );

  const { data: pendingParcelasData } = useLiveData(
    () => countPendingParcelas({ plantacionId }),
    [plantacionId]
  );

  const pendingGroupsCount = pendingData?.[0]?.cnt ?? 0;
  const blockedByNN = nnBlockedData?.[0]?.cnt ?? 0;
  const pendingParcelasCount = pendingParcelasData?.[0]?.cnt ?? 0;
  const pendingPhotosCount = pendingPhotosData?.[0]?.cnt ?? 0;

  // Parcelas y fotos pendientes también suman al contador global (issue #71).
  const pendingCount = pendingGroupsCount + pendingParcelasCount + pendingPhotosCount;
  const syncableCount = pendingGroupsCount - blockedByNN;

  return {
    pendingCount,
    syncableCount,
    blockedByNN,
    pendingGroupsCount,
    pendingPhotosCount,
    pendingParcelasCount,
  };
}
