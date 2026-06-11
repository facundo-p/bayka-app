import {
  GPS_ACCURACY_GOOD_MAX_METERS,
  GPS_ACCURACY_REGULAR_MAX_METERS,
  GPS_FIX_STALE_MS,
} from '../../constants/gpsCapture';
import type { GpsFix, GpsPermissionStatus } from './locationClient';

export type GpsSignalLevel = 'buena' | 'regular' | 'mala' | 'sin-senal';

export interface GpsSignalParams {
  permissionStatus: GpsPermissionStatus;
  servicesEnabled: boolean | null;
  fix: GpsFix | null;
  nowMs: number;
}

/**
 * Mapea el estado del watcher al nivel del semáforo. 'sin-senal' cubre:
 * permiso no otorgado, GPS apagado, sin fix aún, fix viejo (señal perdida)
 * y accuracy no reportada por el provider.
 */
export function getGpsSignalLevel(params: GpsSignalParams): GpsSignalLevel {
  const { permissionStatus, servicesEnabled, fix, nowMs } = params;
  if (permissionStatus !== 'otorgado' || servicesEnabled === false) return 'sin-senal';
  if (!fix || fix.accuracy === null) return 'sin-senal';
  if (nowMs - fix.timestamp > GPS_FIX_STALE_MS) return 'sin-senal';
  if (fix.accuracy <= GPS_ACCURACY_GOOD_MAX_METERS) return 'buena';
  if (fix.accuracy <= GPS_ACCURACY_REGULAR_MAX_METERS) return 'regular';
  return 'mala';
}
