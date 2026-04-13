import { useMemo } from 'react';
import { useLiveData } from '../database/liveQuery';
import { getPendingSyncCounts } from '../queries/dashboardQueries';

/**
 * Returns a Map of plantacionId -> pendingCount for all plantations.
 * Wraps dashboardQueries.getPendingSyncCounts() as a reactive hook.
 * Screens MUST use this hook instead of calling getPendingSyncCounts() directly.
 */
export function usePendingSyncMap(): Map<string, number> {
  const { data: pendingSyncCounts } = useLiveData(() => getPendingSyncCounts());

  return useMemo(() => {
    const map = new Map<string, number>();
    if (pendingSyncCounts) {
      for (const c of pendingSyncCounts) {
        map.set(c.plantacionId, c.pendingCount);
      }
    }
    return map;
  }, [pendingSyncCounts]);
}
