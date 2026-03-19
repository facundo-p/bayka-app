import { useState, useCallback } from 'react';
import { syncPlantation, SyncSubGroupResult, SyncProgress } from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';

export type SyncState = 'idle' | 'syncing' | 'done';

export function useSync(plantacionId: string) {
  const [state, setState] = useState<SyncState>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncSubGroupResult[]>([]);

  const startSync = useCallback(async () => {
    setState('syncing');
    setProgress(null);
    setResults([]);
    try {
      const res = await syncPlantation(plantacionId, setProgress);
      setResults(res);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setState('done');
      notifyDataChanged(); // single refresh after all sync operations
    }
  }, [plantacionId]);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResults([]);
  }, []);

  const hasFailures = results.some((r) => !r.success);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    state,
    progress,
    results,
    startSync,
    reset,
    hasFailures,
    successCount,
    failureCount,
  };
}
