import { useState, useCallback } from 'react';
import {
  syncPlantation,
  syncAllPlantations,
  uploadPendingPhotos,
  downloadPhotosForPlantation,
  SyncSubGroupResult,
  SyncProgress,
  PhotoSyncProgress,
  GlobalSyncProgress,
} from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';

export type SyncState = 'idle' | 'pulling' | 'pushing' | 'uploading-photos' | 'downloading-photos' | 'done';

export function useSync(plantacionId?: string) {
  const [state, setState] = useState<SyncState>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncSubGroupResult[]>([]);
  const [pullSuccess, setPullSuccess] = useState<boolean | null>(null);
  const [photoProgress, setPhotoProgress] = useState<PhotoSyncProgress | null>(null);
  const [photoResult, setPhotoResult] = useState<{ uploaded?: number; failed?: number; downloaded?: number } | null>(null);
  const [globalProgress, setGlobalProgress] = useState<{ plantationName: string; done: number; total: number } | null>(null);

  const startBidirectionalSync = useCallback(async (incluirFotos: boolean = true) => {
    if (!plantacionId) {
      console.warn('[Sync] startBidirectionalSync called without plantacionId');
      return;
    }
    setState('pulling');
    setProgress(null);
    setResults([]);
    setPullSuccess(null);
    setPhotoProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);

    try {
      // syncPlantation does pull-then-push internally
      setState('pushing');
      const res = await syncPlantation(plantacionId, setProgress);
      setResults(res);
      setPullSuccess(true);

      if (incluirFotos) {
        setState('uploading-photos');
        const uploadRes = await uploadPendingPhotos(plantacionId, setPhotoProgress);
        setState('downloading-photos');
        const downloadRes = await downloadPhotosForPlantation(plantacionId, setPhotoProgress);
        setPhotoResult({
          uploaded: uploadRes.uploaded,
          failed: uploadRes.failed + downloadRes.failed,
          downloaded: downloadRes.downloaded,
        });
      }
    } catch (err) {
      console.error('[Sync] Bidirectional sync failed:', err);
      setPullSuccess(false);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, [plantacionId]);

  const startGlobalSync = useCallback(async (incluirFotos: boolean = true) => {
    setState('pulling');
    setProgress(null);
    setResults([]);
    setPullSuccess(null);
    setPhotoProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);

    try {
      const allResults = await syncAllPlantations(
        (info: GlobalSyncProgress) => {
          setGlobalProgress({
            plantationName: info.plantationName,
            done: info.plantationDone,
            total: info.plantationTotal,
          });
          if (info.subgroupProgress) {
            setState('pushing');
            setProgress(info.subgroupProgress);
          } else {
            setState('pulling');
          }
        },
        incluirFotos
      );

      // Flatten results from all plantations
      const flatResults = allResults.flatMap(r => r.results);
      setResults(flatResults);
      setPullSuccess(true);
    } catch (err) {
      console.error('[Sync] Global sync failed:', err);
      setPullSuccess(false);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResults([]);
    setPullSuccess(null);
    setPhotoProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);
  }, []);

  const hasFailures = results.some((r) => !r.success);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    state,
    progress,
    results,
    startBidirectionalSync,
    startGlobalSync,
    pullSuccess,
    reset,
    hasFailures,
    successCount,
    failureCount,
    photoProgress,
    photoResult,
    globalProgress,
  };
}
