import { useState, useCallback } from 'react';
import {
  syncPlantation,
  pullFromServer,
  pullSpeciesFromServer,
  uploadPendingPhotos,
  downloadPhotosForPlantation,
  SyncSubGroupResult,
  SyncProgress,
  PhotoSyncProgress,
} from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';
import { supabase } from '../supabase/client';

export type SyncState = 'idle' | 'syncing' | 'pulling' | 'uploading-photos' | 'downloading-photos' | 'done';

export function useSync(plantacionId: string) {
  const [state, setState] = useState<SyncState>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncSubGroupResult[]>([]);
  const [pullSuccess, setPullSuccess] = useState<boolean | null>(null);
  const [photoProgress, setPhotoProgress] = useState<PhotoSyncProgress | null>(null);
  const [photoResult, setPhotoResult] = useState<{ uploaded?: number; failed?: number; downloaded?: number } | null>(null);

  const startSync = useCallback(async (incluirFotos: boolean = true) => {
    setState('syncing');
    setProgress(null);
    setResults([]);
    setPullSuccess(null);
    setPhotoProgress(null);
    setPhotoResult(null);
    try {
      const res = await syncPlantation(plantacionId, setProgress);
      setResults(res);

      if (incluirFotos) {
        setState('uploading-photos');
        const photoRes = await uploadPendingPhotos(plantacionId, setPhotoProgress);
        setPhotoResult({ uploaded: photoRes.uploaded, failed: photoRes.failed });
      }
    } catch (err) {
      console.error('[Sync] Sync failed:', err);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, [plantacionId]);

  const startPull = useCallback(async (incluirFotos: boolean = true) => {
    setState('pulling');
    setPullSuccess(null);
    setPhotoProgress(null);
    setPhotoResult(null);
    try {
      await supabase.auth.getSession();
      await pullSpeciesFromServer();
      await pullFromServer(plantacionId);
      setPullSuccess(true);

      if (incluirFotos) {
        setState('downloading-photos');
        const photoRes = await downloadPhotosForPlantation(plantacionId, setPhotoProgress);
        setPhotoResult({ downloaded: photoRes.downloaded, failed: photoRes.failed });
      }
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
    setPhotoProgress(null);
    setPhotoResult(null);
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
    photoProgress,
    photoResult,
  };
}
