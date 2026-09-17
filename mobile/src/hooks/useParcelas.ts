/**
 * useParcelas — reactive list of parcelas for a plantation with per-parcela
 * stats. Pure orchestrator: invokes parcelaQueries.listByPlantacionWithStats
 * via useLiveData.
 *
 * Tombstoned parcelas never surface (filtered by the underlying query).
 *
 * Loading semantics: useLiveData starts with data=undefined; we expose
 * isLoading=true while data is still undefined. error stays null for now
 * (useLiveData logs errors to console — propagating them properly is a
 * future enhancement).
 */
import { useLiveData } from '../database/liveQuery';
import { listByPlantacionWithStats } from '../queries/parcelaQueries';
import type { ParcelaWithStats } from '../queries/parcelaQueries';

export type { ParcelaWithStats };

export function useParcelas(plantacionId: string | undefined): {
  parcelas: ParcelaWithStats[];
  isLoading: boolean;
  error: Error | null;
} {
  const pid = plantacionId ?? '';
  const { data } = useLiveData<ParcelaWithStats[]>(
    () => (pid ? listByPlantacionWithStats(pid) : Promise.resolve([])),
    [pid],
  );
  if (!plantacionId) return { parcelas: [], isLoading: false, error: null };
  return { parcelas: data ?? [], isLoading: data === undefined, error: null };
}
