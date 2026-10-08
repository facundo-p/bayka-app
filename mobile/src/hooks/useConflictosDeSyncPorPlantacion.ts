import { useMemo } from 'react';
import { useLiveData } from '../database/liveQuery';
import { conflictosDeSyncPorPlantacion } from '../queries/conflictosDeSyncQueries';

/** plantacionId → conflictos de sincronización sin resolver (#804). */
export function useConflictosDeSyncPorPlantacion(): ReadonlyMap<string, number> {
  const { data } = useLiveData(() => conflictosDeSyncPorPlantacion());
  return useMemo(() => new Map((data ?? []).map((f) => [f.plantacionId, f.cantidad])), [data]);
}
