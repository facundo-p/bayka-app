import { useMemo } from 'react';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from './useCurrentUserId';
import {
  countPendingGroupsByPlantation,
  countPendingParcelasByPlantation,
  countPendingTreePhotosByPlantation,
} from '../queries/pendingSyncQueries';

/**
 * Map plantacionId → total de pendientes de sync de esa plantación.
 *
 * Issue #71: cuenta lo mismo que usePendingSyncCount (grupos del usuario +
 * parcelas, incl. tombstones + fotos), para que el dot de cada tarjeta
 * señale exactamente qué plantación enciende el global.
 */
export function usePendingSyncMap(): Map<string, number> {
  const userId = useCurrentUserId();

  const { data: groupRows } = useLiveData(
    () => countPendingGroupsByPlantation(userId),
    [userId]
  );
  const { data: parcelaRows } = useLiveData(() => countPendingParcelasByPlantation());
  const { data: photoRows } = useLiveData(() => countPendingTreePhotosByPlantation());

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const rows of [groupRows, parcelaRows, photoRows]) {
      for (const r of rows ?? []) {
        map.set(r.plantacionId, (map.get(r.plantacionId) ?? 0) + r.cnt);
      }
    }
    return map;
  }, [groupRows, parcelaRows, photoRows]);
}
