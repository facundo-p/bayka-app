import {
  insertTree,
  InsertTreeParams,
  InsertTreeResult,
  updateTreeGps,
} from '../../repositories/TreeRepository';
import { localIsoFromMs } from '../../utils/dateUtils';
import { gpsLog } from '../../utils/gpsLogger';
import { getGpsEnabled } from '../settings/gpsEnabledStore';
import { isFixFresh, shouldCaptureGps } from './captureRules';
import { getCurrentGpsFix, GpsFix } from './locationClient';

export { shouldCaptureGps } from './captureRules';

/** Alta de árbol + captura GPS si corresponde por posición (mismo camino para botonera de especies y N/N); el insert nunca espera al GPS, el punto se adjunta async. */
export async function insertTreeWithGps(
  params: InsertTreeParams,
  frequency: number,
  getLastFix?: () => GpsFix | null,
): Promise<InsertTreeResult> {
  const tapAtMs = Date.now();
  const inserted = await insertTree(params);
  if (shouldCaptureGps(inserted.posicion, frequency)) {
    void attachGpsCapture(inserted.id, getLastFix?.() ?? null, tapAtMs);
  }
  return inserted;
}

/**
 * Adjunta el punto GPS al árbol sin bloquear el alta: usa el fix del watcher si es reciente
 * (≤ edad máxima), si no pide uno fresco (GPS caliente → rápido); sin fix, el árbol queda sin
 * coordenadas. `gpsCapturedAt` es el momento del tap, no el de resolución del fix; el alta lo
 * invoca fire-and-forget, la re-captura usa el retorno (true = escrito). Nunca lanza. Con la
 * medición desactivada (toggle de Ajustes), no captura ni prende el GPS.
 */
export async function attachGpsCapture(
  treeId: string,
  watcherFix: GpsFix | null,
  tapAtMs: number,
): Promise<boolean> {
  if (!getGpsEnabled()) {
    gpsLog.info(`árbol ${treeId}: captura GPS omitida (medición desactivada)`);
    return false;
  }
  try {
    const fix = isFixFresh(watcherFix, tapAtMs) ? watcherFix : await getCurrentGpsFix();
    if (!fix) {
      gpsLog.info(`árbol ${treeId} queda sin coordenadas (sin fix disponible)`);
      return false;
    }
    await updateTreeGps(treeId, {
      latitude: fix.latitude,
      longitude: fix.longitude,
      gpsAccuracy: fix.accuracy,
      gpsCapturedAt: localIsoFromMs(tapAtMs),
    });
    return true;
  } catch (e) {
    gpsLog.error(`captura GPS falló para árbol ${treeId}`, e);
    return false;
  }
}

/** Re-captura manual del punto del último árbol (o a demanda si la frecuencia no aplicó); reemplaza lat/lng/precisión/timestamp, o conserva el punto anterior si no hay fix. */
export function recaptureTreeGps(
  treeId: string,
  getLastFix?: () => GpsFix | null,
): Promise<boolean> {
  return attachGpsCapture(treeId, getLastFix?.() ?? null, Date.now());
}
