import { useState, useCallback } from 'react';
import { syncPlantation, pullFromServer, pullSpeciesFromServer, SyncSubGroupResult, SyncProgress } from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';
import { supabase } from '../supabase/client';

export type SyncState = 'idle' | 'syncing' | 'pulling' | 'done';

export function useSync(plantacionId: string) {
  const [state, setState] = useState<SyncState>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncSubGroupResult[]>([]);
  const [pullSuccess, setPullSuccess] = useState<boolean | null>(null);

  const startSync = useCallback(async () => {
    setState('syncing');
    setProgress(null);
    setResults([]);
    setPullSuccess(null);
    try {
      const res = await syncPlantation(plantacionId, setProgress);
      setResults(res);
    } catch (err) {
      console.error('[Sync] Sync failed:', err);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, [plantacionId]);

  const startPull = useCallback(async () => {
    setState('pulling');
    setPullSuccess(null);
    try {
      await supabase.auth.getSession();
      await pullSpeciesFromServer();
      await pullFromServer(plantacionId);
      setPullSuccess(true);
    } catch (err) {
      console.error('[Sync] Pull failed:', err);
      setPullSuccess(false);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, [plantacionId]);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResults([]);
    setPullSuccess(null);
  }, []);

  const hasFailures = results.some((r) => !r.success);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    state,
    progress,
    results,
    startSync,
    startPull,
    pullSuccess,
    reset,
    hasFailures,
    successCount,
    failureCount,
  };
}
