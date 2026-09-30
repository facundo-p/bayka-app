import { useState, useCallback, useRef } from 'react';
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
  DownloadPhaseProgress,
  GlobalSyncProgress,
  SYNC_STATE,
  SyncState,
  esSinAcceso,
  esEliminada,
  esPullSinDatos,
  faseDeProgresoGlobal,
  plantacionesOmitidas,
  SIN_OMITIDAS,
  esSesionExpirada,
} from '../services/SyncService';
import type { PlantacionesOmitidas } from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';
import { cancelarCorrida, esCancelacion, iniciarCorrida, terminarCorrida } from '../services/sync/cancelacion';
import { esTimeout } from '../supabase/fetchConTimeout';
import { useWatchdogDeSync } from './useWatchdogDeSync';

export type { SyncState };

type PhotoResult = { uploaded?: number; uploadFailed?: number; downloaded?: number; downloadFailed?: number };

export function useSync(plantacionId?: string) {
  const [state, setState] = useState<SyncState>(SYNC_STATE.idle);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncGroupResult[]>([]);
  const [parcelaResults, setParcelaResults] = useState<SyncParcelaResult[]>([]);
  const [plantationResults, setPlantationResults] = useState<SyncPlantationResult[]>([]);
  const [pullSuccess, setPullSuccess] = useState<boolean | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [eliminada, setEliminada] = useState(false);
  const [omitidas, setOmitidas] = useState<PlantacionesOmitidas>(SIN_OMITIDAS);
  const [authExpired, setAuthExpired] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<PhotoSyncProgress | null>(null);
  const [phaseProgress, setPhaseProgress] = useState<DownloadPhaseProgress | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoResult | null>(null);
  const [globalProgress, setGlobalProgress] = useState<{ plantationName: string; done: number; total: number } | null>(null);
  const [cancelado, setCancelado] = useState(false);
  const [huboTimeout, setHuboTimeout] = useState(false);

  // Momento de la última señal de avance: lo lee el watchdog por reloj.
  const ultimoAvance = useRef(Date.now());
  const marcarAvance = useCallback(() => {
    ultimoAvance.current = Date.now();
  }, []);

  const enCurso = state !== SYNC_STATE.idle && state !== SYNC_STATE.done;
  const estancado = useWatchdogDeSync(enCurso, ultimoAvance);

  // Limpia todo el estado por-corrida (todo menos `state`, que fija cada caller).
  const resetSyncState = useCallback(() => {
    setProgress(null);
    setResults([]);
    setParcelaResults([]);
    setPlantationResults([]);
    setPullSuccess(null);
    setSinAcceso(false);
    setEliminada(false);
    setOmitidas(SIN_OMITIDAS);
    setAuthExpired(false);
    setPhotoProgress(null);
    setPhaseProgress(null);
    setPhotoResult(null);
    setGlobalProgress(null);
    setCancelado(false);
    setHuboTimeout(false);
  }, []);

  /**
   * Arranque y cierre de una corrida cancelable. Va acá y no en los orquestadores
   * porque el botón vive acá, y porque así también quedan adentro las fases de
   * fotos, que se llaman fuera de ellos.
   */
  const clasificarFalla = useCallback((err: unknown) => {
    if (esCancelacion(err)) {
      setCancelado(true);
      return;
    }
    console.error('[Sync] falló:', err);
    setPullSuccess(false);
    if (esTimeout(err)) setHuboTimeout(true);
    if (esSesionExpirada(err)) setAuthExpired(true);
  }, []);

  /**
   * Subida siempre: una foto sacada acá que no llega al server existe solo en este
   * celular. La bajada depende de la preferencia (#565).
   *
   * Limpiar el progreso entre fases: una fase sin fotos no emite nada (#447), y sin
   * esto el modal seguiría mostrando el contador y la velocidad de la anterior (#450).
   */
  const sincronizarFotos = useCallback(async (targetPlantacionId: string, descargarFotos: boolean): Promise<PhotoResult> => {
    const avisarFotos = (fotos: PhotoSyncProgress) => {
      marcarAvance();
      setPhotoProgress(fotos);
    };
    setState(SYNC_STATE.uploadingPhotos);
    setPhotoProgress(null);
    const subida = await uploadPendingPhotos(targetPlantacionId, avisarFotos);
    const resultado: PhotoResult = { uploaded: subida.uploaded, uploadFailed: subida.failed };
    if (!descargarFotos) return resultado;

    setState(SYNC_STATE.downloadingPhotos);
    setPhotoProgress(null);
    const bajada = await downloadPhotosForPlantation(targetPlantacionId, avisarFotos);
    return { ...resultado, downloaded: bajada.downloaded, downloadFailed: bajada.failed };
  }, [marcarAvance]);

  // Shared by startBidirectionalSync (uses the hook's own plantacionId) and
  // startPlantationSync (explicit target) — both ran the identical pull+push
  // sequence for a single plantation, differing only in where the id came from.
  const runPlantationSync = useCallback(async (targetPlantacionId: string, descargarFotos: boolean) => {
    setState(SYNC_STATE.pulling);
    resetSyncState();
    iniciarCorrida();
    marcarAvance();

    try {
      let accesoRevocado = false;
      let falloElPull = false;
      const res = await syncPlantation(targetPlantacionId, {
        // El push arranca cuando llega su primer progreso: antes, `pushing` se
        // seteaba de entrada y el pull entero corría mostrando "Subiendo grupos...".
        onProgress: (p) => {
          marcarAvance();
          setState(SYNC_STATE.pushing);
          setProgress(p);
        },
        // Las fotos de cada grupo se suben dentro del push y son el tramo más largo
        // del flujo: sin esto el modal queda clavado en "grupo i de n" (#447).
        onPhotoProgress: (fotos) => {
          marcarAvance();
          setState(SYNC_STATE.uploadingPhotos);
          setPhotoProgress(fotos);
        },
        // `null` = el pull terminó, por éxito, sin acceso o excepción. Sin esa señal
        // la fase quedaba congelada y el estado en `pulling` durante todo el push.
        onPhaseProgress: (fase) => {
          marcarAvance();
          if (fase) {
            setState(SYNC_STATE.pulling);
            setPhaseProgress(fase);
            return;
          }
          setPhaseProgress(null);
          if (!accesoRevocado) setState(SYNC_STATE.pushing);
        },
        onParcelaResults: setParcelaResults,
        onPlantationResults: setPlantationResults,
        onPullResult: (pull) => {
          accesoRevocado = esPullSinDatos(pull);
          setSinAcceso(esSinAcceso(pull));
          setEliminada(esEliminada(pull));
        },
        onPullError: (e) => {
          falloElPull = true;
          if (esTimeout(e)) setHuboTimeout(true);
        },
      });
      setResults(res);
      setPullSuccess(!accesoRevocado && !falloElPull);

      // Sin acceso o eliminada no hay nada que subir ni bajar: las fotos viven en el mismo bucket.
      if (!accesoRevocado) setPhotoResult(await sincronizarFotos(targetPlantacionId, descargarFotos));
    } catch (err) {
      clasificarFalla(err);
    } finally {
      terminarCorrida();
      setState(SYNC_STATE.done);
      notifyDataChanged();
    }
  }, [resetSyncState, marcarAvance, clasificarFalla, sincronizarFotos]);

  const startBidirectionalSync = useCallback(async (descargarFotos: boolean = true) => {
    if (!plantacionId) {
      console.warn('[Sync] startBidirectionalSync called without plantacionId');
      return;
    }
    await runPlantationSync(plantacionId, descargarFotos);
  }, [plantacionId, runPlantationSync]);

  const startPlantationSync = useCallback(async (targetPlantacionId: string, descargarFotos: boolean = true) => {
    await runPlantationSync(targetPlantacionId, descargarFotos);
  }, [runPlantationSync]);

  const startGlobalSync = useCallback(async (descargarFotos: boolean = true) => {
    setState(SYNC_STATE.pulling);
    resetSyncState();
    iniciarCorrida();
    marcarAvance();

    try {
      const allResults = await syncAllPlantations(
        (info: GlobalSyncProgress) => {
          marcarAvance();
          setGlobalProgress({
            plantationName: info.plantationName,
            done: info.plantationDone,
            total: info.plantationTotal,
          });
          const fase = faseDeProgresoGlobal(info);
          setState(fase.state);
          if (fase.photoProgress) setPhotoProgress(fase.photoProgress);
          if (fase.subgroupProgress) setProgress(fase.subgroupProgress);
          if (fase.phaseProgress !== undefined) setPhaseProgress(fase.phaseProgress);
        },
        descargarFotos,
        setPlantationResults
      );

      const flatResults = allResults.flatMap(r => r.results);
      setResults(flatResults);
      setParcelaResults(allResults.flatMap(r => r.parcelas ?? []));
      setOmitidas(plantacionesOmitidas(allResults));
      // Una corrida donde todas las plantaciones fallaron llegaba acá con listas
      // vacías y se reportaba como exitosa.
      const fallidas = allResults.filter((r) => r.fallo);
      setPullSuccess(fallidas.length === 0);
      if (fallidas.some((r) => esTimeout(r.fallo))) setHuboTimeout(true);
    } catch (err) {
      clasificarFalla(err);
    } finally {
      terminarCorrida();
      setState(SYNC_STATE.done);
      notifyDataChanged();
    }
  }, [resetSyncState, marcarAvance, clasificarFalla]);

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
    /** La sync lleva 45s sin avanzar: el modal ofrece el botón de cancelar (#451). */
    estancado,
    cancelar: cancelarCorrida,
    cancelado,
    huboTimeout,
    results,
    parcelaResults,
    plantationResults,
    authExpired,
    startBidirectionalSync,
    startPlantationSync,
    startGlobalSync,
    pullSuccess,
    sinAcceso,
    /** La plantación sincronizada fue eliminada en el server (#478). */
    eliminada,
    /** Sync global: plantaciones salteadas por sin acceso o eliminadas (#478). */
    omitidas,
    reset,
    hasFailures,
    successCount,
    failureCount,
    parcelaFailureCount,
    plantationFailureCount,
    photoProgress,
    phaseProgress,
    photoResult,
    globalProgress,
  };
}
