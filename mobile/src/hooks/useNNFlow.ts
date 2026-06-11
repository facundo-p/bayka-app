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
}: UseNNFlowParams): UseNNFlowResult {

  const registerNN = useCallback(async () => {
    if (isReadOnly || !userId) return;
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    // El "tap" GPS es post-foto: el técnico sigue parado junto al árbol y el
    // watcher pudo pausarse mientras la cámara tuvo el foco.
    await insertTreeWithGps(
      { grupoId, grupoCodigo, especieId: null, especieCodigo: 'NN', fotoUrl: photoUri, userId },
      gpsCaptureFrequency,
      getLastGpsFix,
    );
  }, [isReadOnly, userId, grupoId, grupoCodigo, pickPhoto, gpsCaptureFrequency, getLastGpsFix]);

  return {
    registerNN,
    hasUnresolvedNN: unresolvedNN > 0,
    nnCount: unresolvedNN,
  };
}
