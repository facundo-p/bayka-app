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

/** Punto GPS tomado en el instante del toque, antes de la foto (#910): el técnico puede alejarse para sacarla sin mover el punto. */
export interface GpsAlTap {
  tapAtMs: number;
  /** Resuelve el fix (o null); nunca rechaza. */
  fix: Promise<GpsFix | null>;
}

/** Fija el punto al toque: el fix del watcher si es reciente, si no pide uno fresco en ese instante. Con la medición desactivada no prende el GPS. */
export function capturarGpsAlTap(getLastFix?: () => GpsFix | null): GpsAlTap {
  const tapAtMs = Date.now();
  if (!getGpsEnabled()) return { tapAtMs, fix: Promise.resolve(null) };
  const watcherFix = getLastFix?.() ?? null;
  const fix = isFixFresh(watcherFix, tapAtMs) ? Promise.resolve(watcherFix) : getCurrentGpsFix();
  return { tapAtMs, fix };
}

/** Alta de árbol + captura GPS si corresponde por posición (mismo camino para botonera de especies y N/N); el insert nunca espera al GPS, el punto se adjunta async. */
export async function insertTreeWithGps(
  params: InsertTreeParams,
  frequency: number,
  gpsAlTap: GpsAlTap,
): Promise<InsertTreeResult> {
  const inserted = await insertTree(params);
  if (shouldCaptureGps(inserted.posicion, frequency)) {
    void attachGpsCapture(inserted.id, gpsAlTap);
  }
  return inserted;
}

/**
 * Adjunta al árbol el punto tomado al toque sin bloquear el alta; sin fix, el árbol queda sin
 * coordenadas. `gpsCapturedAt` es el momento del toque, no el de resolución del fix; el alta lo
 * invoca fire-and-forget, la re-captura usa el retorno (true = escrito). Nunca lanza. Con la
 * medición desactivada (toggle de Ajustes), no escribe.
 */
export async function attachGpsCapture(treeId: string, { tapAtMs, fix: fixAlTap }: GpsAlTap): Promise<boolean> {
  if (!getGpsEnabled()) {
    gpsLog.info(`árbol ${treeId}: captura GPS omitida (medición desactivada)`);
    return false;
  }
  try {
    const fix = await fixAlTap;
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
  return attachGpsCapture(treeId, capturarGpsAlTap(getLastFix));
}
