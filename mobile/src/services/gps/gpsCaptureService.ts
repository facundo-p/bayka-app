import {
  insertTree,
  InsertTreeParams,
  InsertTreeResult,
  updateTreeGps,
} from '../../repositories/TreeRepository';
import { localIsoFromMs } from '../../utils/dateUtils';
import { gpsLog } from '../../utils/gpsLogger';
import { isFixFresh, shouldCaptureGps } from './captureRules';
import { getCurrentGpsFix, GpsFix } from './locationClient';

export { shouldCaptureGps } from './captureRules';

/**
 * Alta de árbol + captura GPS si corresponde por posición. Camino único para
 * la botonera de especies y el flujo N/N (cuentan posiciones por igual).
 * El insert nunca espera al GPS: el punto se adjunta async al árbol correcto.
 */
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
 * Adjunta el punto GPS al árbol recién registrado, sin bloquear el alta:
 * - Si el fix del watcher es esencialmente actual (≤ edad máxima), se usa ese.
 * - Si quedó viejo, se pide un fix fresco en el instante (GPS caliente → rápido).
 * - Si no hay fix (sin permiso/señal/timeout), el árbol queda sin coordenadas.
 *
 * `gpsCapturedAt` registra el momento del tap, no el de resolución del fix.
 * Se invoca fire-and-forget: cualquier error queda logueado, nunca lanzado.
 */
export async function attachGpsCapture(
  treeId: string,
  watcherFix: GpsFix | null,
  tapAtMs: number,
): Promise<void> {
  try {
    const fix = isFixFresh(watcherFix, tapAtMs) ? watcherFix : await getCurrentGpsFix();
    if (!fix) {
      gpsLog.info(`árbol ${treeId} queda sin coordenadas (sin fix disponible)`);
      return;
    }
    await updateTreeGps(treeId, {
      latitude: fix.latitude,
      longitude: fix.longitude,
      gpsAccuracy: fix.accuracy,
      gpsCapturedAt: localIsoFromMs(tapAtMs),
    });
  } catch (e) {
    gpsLog.error(`captura GPS falló para árbol ${treeId}`, e);
  }
}
