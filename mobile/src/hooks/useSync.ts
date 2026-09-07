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
  SYNC_STATE,
  SyncState,
  esSinAcceso,
} from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';

export type { SyncState };

export function useSync(plantacionId?: string) {
  const [state, setState] = useState<SyncState>(SYNC_STATE.idle);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncGroupResult[]>([]);
  const [parcelaResults, setParcelaResults] = useState<SyncParcelaResult[]>([]);
  const [plantationResults, setPlantationResults] = useState<SyncPlantationResult[]>([]);
  const [pullSuccess, setPullSuccess] = useState<boolean | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<PhotoSyncProgress | null>(null);
  const [photoResult, setPhotoResult] = useState<{ uploaded?: number; uploadFailed?: number; downloaded?: number; downloadFailed?: number } | null>(null);
  const [globalProgress, setGlobalProgress] = useState<{ plantationName: string; done: number; total: number } | null>(null);

  // Limpia todo el estado por-corrida (todo menos `state`, que fija cada caller).
  const resetSyncState = useCallback(() => {
    setProgress(null);
    setResults([]);
    setParcelaResults([]);
    setPlantationResults([]);
    setPullSuccess(null);
    setSinAcceso(false);
    setAuthExpired(false);
    setPhotoProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);
  }, []);

  // Shared by startBidirectionalSync (uses the hook's own plantacionId) and
  // startPlantationSync (explicit target) — both ran the identical pull+push
  // sequence for a single plantation, differing only in where the id came from.
  const runPlantationSync = useCallback(async (targetPlantacionId: string, incluirFotos: boolean) => {
    setState(SYNC_STATE.pulling);
    resetSyncState();

    try {
      // syncPlantation does pull-then-push internally
      setState(SYNC_STATE.pushing);
      let accesoRevocado = false;
      const res = await syncPlantation(
        targetPlantacionId,
        setProgress,
        setParcelaResults,
        setPlantationResults,
        (pull) => {
          accesoRevocado = esSinAcceso(pull);
          setSinAcceso(accesoRevocado);
        },
      );
      setResults(res);
      setPullSuccess(!accesoRevocado);

      // Sin acceso no hay nada que subir ni bajar: las fotos viven en el mismo bucket.
      if (incluirFotos && !accesoRevocado) {
        setState(SYNC_STATE.uploadingPhotos);
        const uploadRes = await uploadPendingPhotos(targetPlantacionId, setPhotoProgress);
        setState(SYNC_STATE.downloadingPhotos);
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
      setState(SYNC_STATE.done);
      notifyDataChanged();
    }
  }, [resetSyncState]);

  const startBidirectionalSync = useCallback(async (incluirFotos: boolean = true) => {
    if (!plantacionId) {
      console.warn('[Sync] startBidirectionalSync called without plantacionId');
      return;
    }
    await runPlantationSync(plantacionId, incluirFotos);
  }, [plantacionId, runPlantationSync]);

  const startPlantationSync = useCallback(async (targetPlantacionId: string, incluirFotos: boolean = true) => {
    await runPlantationSync(targetPlantacionId, incluirFotos);
  }, [runPlantationSync]);

  const startGlobalSync = useCallback(async (incluirFotos: boolean = true) => {
    setState(SYNC_STATE.pulling);
    resetSyncState();

    try {
      const allResults = await syncAllPlantations(
        (info: GlobalSyncProgress) => {
          setGlobalProgress({
            plantationName: info.plantationName,
            done: info.plantationDone,
            total: info.plantationTotal,
          });
          if (info.subgroupProgress) {
            setState(SYNC_STATE.pushing);
            setProgress(info.subgroupProgress);
          } else {
            setState(SYNC_STATE.pulling);
          }
        },
        incluirFotos,
        setPlantationResults
      );

      const flatResults = allResults.flatMap(r => r.results);
      setResults(flatResults);
      setParcelaResults(allResults.flatMap(r => r.parcelas ?? []));
      setPullSuccess(true);
    } catch (err) {
      console.error('[Sync] Global sync failed:', err);
      setPullSuccess(false);
      if ((err as { name?: string })?.name === 'SessionExpiredError') setAuthExpired(true);
    } finally {
      setState(SYNC_STATE.done);
      notifyDataChanged();
    }
  }, [resetSyncState]);

  const reset = useCallback(() => {
    setState(SYNC_STATE.idle);
    resetSyncState();
  }, [resetSyncState]);

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
    sinAcceso,
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
