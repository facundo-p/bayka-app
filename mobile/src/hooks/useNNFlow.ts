import { useCallback } from 'react';
import { insertTreeWithGps } from '../services/gps/gpsCaptureService';
import type { GpsFix } from '../services/gps/locationClient';

export interface UseNNFlowParams {
  grupoId: string;
  grupoCodigo: string;
  userId: string;
  isReadOnly: boolean;
  unresolvedNN: number;
  pickPhoto: () => Promise<string | null>;
  /** Frecuencia de captura GPS de la plantación (los N/N cuentan posiciones igual). */
  gpsCaptureFrequency: number;
  getLastGpsFix?: () => GpsFix | null;
  /** Surface de errores de escritura (#90): sin esto, un throw del insert se
   *  perdía como unhandled rejection y el N/N no se registraba sin aviso. */
  onError?: (mensaje: string) => void;
}

export interface UseNNFlowResult {
  registerNN: () => Promise<void>;
  hasUnresolvedNN: boolean;
  nnCount: number;
}

export function useNNFlow({
  grupoId,
  grupoCodigo,
  userId,
  isReadOnly,
  unresolvedNN,
  pickPhoto,
  gpsCaptureFrequency,
  getLastGpsFix,
  onError,
}: UseNNFlowParams): UseNNFlowResult {

  const registerNN = useCallback(async () => {
    if (isReadOnly || !userId) return;
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    try {
      // El "tap" GPS es post-foto: el técnico sigue parado junto al árbol y el
      // watcher pudo pausarse mientras la cámara tuvo el foco.
      await insertTreeWithGps(
        { grupoId, grupoCodigo, especieId: null, especieCodigo: 'NN', fotoUrl: photoUri, userId },
        gpsCaptureFrequency,
        getLastGpsFix,
      );
    } catch (e) {
      onError?.(e instanceof Error && e.message ? e.message : 'No se pudo registrar el árbol N/N.');
    }
  }, [isReadOnly, userId, grupoId, grupoCodigo, pickPhoto, gpsCaptureFrequency, getLastGpsFix, onError]);

  return {
    registerNN,
    hasUnresolvedNN: unresolvedNN > 0,
    nnCount: unresolvedNN,
  };
}
