import { useMemo } from 'react';
import { useLiveData } from '../database/liveQuery';
import { useQuienSube } from './useQuienSube';
import {
  countPendingGroupsByPlantation,
  countPendingParcelasByPlantation,
  countPendingTreePhotosByPlantation,
} from '../queries/pendingSyncQueries';

/**
 * Map plantacionId → total de pendientes de sync de esa plantación.
 *
 * Issue #71: cuenta lo mismo que usePendingSyncCount (grupos y fotos que sube el
 * usuario + parcelas, incl. tombstones), para que el dot de cada tarjeta
 * señale exactamente qué plantación enciende el global.
 */
export function usePendingSyncMap(): Map<string, number> {
  const { userId, esAdmin } = useQuienSube();

  const { data: groupRows } = useLiveData(
    () => countPendingGroupsByPlantation({ userId, esAdmin }),
    [userId, esAdmin]
  );
  const { data: parcelaRows } = useLiveData(() => countPendingParcelasByPlantation());
  const { data: photoRows } = useLiveData(
    () => countPendingTreePhotosByPlantation({ userId, esAdmin }),
    [userId, esAdmin]
  );

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
