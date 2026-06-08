import { useState, useCallback } from 'react';
import {
  syncPlantation,
  syncAllPlantations,
  uploadPendingPhotos,
  downloadPhotosForPlantation,
  SyncGroupResult,
  SyncParcelaResult,
  SyncPlantationResult,
  SyncProgress,
  PhotoSyncProgress,
  GlobalSyncProgress,
} from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';

export type SyncState = 'idle' | 'pulling' | 'pushing' | 'uploading-photos' | 'downloading-photos' | 'done';

export function useSync(plantacionId?: string) {
  const [state, setState] = useState<SyncState>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncGroupResult[]>([]);
  const [parcelaResults, setParcelaResults] = useState<SyncParcelaResult[]>([]);
  const [plantationResults, setPlantationResults] = useState<SyncPlantationResult[]>([]);
  const [pullSuccess, setPullSuccess] = useState<boolean | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<PhotoSyncProgress | null>(null);
  const [photoResult, setPhotoResult] = useState<{ uploaded?: number; uploadFailed?: number; downloaded?: number; downloadFailed?: number } | null>(null);
  const [globalProgress, setGlobalProgress] = useState<{ plantationName: string; done: number; total: number } | null>(null);

  const startBidirectionalSync = useCallback(async (incluirFotos: boolean = true) => {
    if (!plantacionId) {
      console.warn('[Sync] startBidirectionalSync called without plantacionId');
      return;
    }
    setState('pulling');
    setProgress(null);
    setResults([]);
    setParcelaResults([]);
    setPlantationResults([]);
    setPullSuccess(null);
    setAuthExpired(false);
    setPhotoProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);

    try {
      // syncPlantation does pull-then-push internally
      setState('pushing');
      const res = await syncPlantation(plantacionId, setProgress, setParcelaResults, setPlantationResults);
      setResults(res);
      setPullSuccess(true);

      if (incluirFotos) {
        setState('uploading-photos');
        const uploadRes = await uploadPendingPhotos(plantacionId, setPhotoProgress);
        setState('downloading-photos');
        const downloadRes = await downloadPhotosForPlantation(plantacionId, setPhotoProgress);
        setPhotoResult({
          uploaded: uploadRes.uploaded,
          uploadFailed: uploadRes.failed,
          downloaded: downloadRes.downloaded,
          downloadFailed: downloadRes.failed,
        });
      }
    } catch (err) {
      console.error('[Sync] Bidirectional sync failed:', err);
      setPullSuccess(false);
      if ((err as { name?: string })?.name === 'SessionExpiredError') setAuthExpired(true);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, [plantacionId]);

  const startPlantationSync = useCallback(async (targetPlantacionId: string, incluirFotos: boolean = true) => {
    setState('pulling');
    setProgress(null);
    setResults([]);
    setParcelaResults([]);
    setPlantationResults([]);
    setPullSuccess(null);
    setAuthExpired(false);
    setPhotoProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);

    try {
      setState('pushing');
      const res = await syncPlantation(targetPlantacionId, setProgress, setParcelaResults, setPlantationResults);
      setResults(res);
      setPullSuccess(true);

      if (incluirFotos) {
        setState('uploading-photos');
        const uploadRes = await uploadPendingPhotos(targetPlantacionId, setPhotoProgress);
        setState('downloading-photos');
        const downloadRes = await downloadPhotosForPlantation(targetPlantacionId, setPhotoProgress);
        setPhotoResult({
          uploaded: uploadRes.uploaded,
          uploadFailed: uploadRes.failed,
          downloaded: downloadRes.downloaded,
          downloadFailed: downloadRes.failed,
        });
      }
    } catch (err) {
      console.error('[Sync] Plantation sync failed:', err);
      setPullSuccess(false);
      if ((err as { name?: string })?.name === 'SessionExpiredError') setAuthExpired(true);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, []);

  const startGlobalSync = useCallback(async (incluirFotos: boolean = true) => {
    setState('pulling');
    setProgress(null);
    setResults([]);
    setParcelaResults([]);
    setPlantationResults([]);
    setPullSuccess(null);
    setAuthExpired(false);
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
        incluirFotos,
        setPlantationResults
      );

      // Flatten results from all plantations
      const flatResults = allResults.flatMap(r => r.results);
      setResults(flatResults);
      setParcelaResults(allResults.flatMap(r => r.parcelas ?? []));
      setPullSuccess(true);
    } catch (err) {
      console.error('[Sync] Global sync failed:', err);
      setPullSuccess(false);
      if ((err as { name?: string })?.name === 'SessionExpiredError') setAuthExpired(true);
    } finally {
      setState('done');
      notifyDataChanged();
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResults([]);
    setParcelaResults([]);
    setPlantationResults([]);
    setPullSuccess(null);
    setAuthExpired(false);
    setPhotoProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);
  }, []);

  const parcelaFailureCount = parcelaResults.filter((r) => !r.success).length;
  const plantationFailureCount = plantationResults.filter((r) => !r.success).length;
  const hasFailures = results.some((r) => !r.success) || parcelaFailureCount > 0 || plantationFailureCount > 0;
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    state,
    progress,
    results,
    parcelaResults,
    plantationResults,
    authExpired,
    startBidirectionalSync,
    startPlantationSync,
    startGlobalSync,
    pullSuccess,
    reset,
    hasFailures,
    successCount,
    failureCount,
    parcelaFailureCount,
    plantationFailureCount,
    photoProgress,
    photoResult,
    globalProgress,
  };
}
