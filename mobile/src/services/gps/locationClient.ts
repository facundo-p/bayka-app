import * as Location from 'expo-location';
import { Linking } from 'react-native';

import {
  GPS_FIX_REQUEST_TIMEOUT_MS,
  GPS_WATCHER_DISTANCE_INTERVAL_METERS,
  GPS_WATCHER_TIME_INTERVAL_MS,
} from '../../constants/gpsCapture';

/** Fix de ubicación normalizado para el resto de la app. */
export interface GpsFix {
  latitude: number;
  longitude: number;
  /** Precisión en metros; null si el provider no la reporta. */
  accuracy: number | null;
  /** Epoch ms del momento en que el provider obtuvo el fix. */
  timestamp: number;
}

export type GpsPermissionStatus = 'pendiente' | 'otorgado' | 'denegado';

export function toGpsFix(location: Location.LocationObject): GpsFix {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? null,
    timestamp: location.timestamp,
  };
}

export async function requestGpsPermission(): Promise<GpsPermissionStatus> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED ? 'otorgado' : 'denegado';
}

/** Lee el permiso actual SIN abrir diálogo (para re-chequear al volver del
 *  background sin spamear prompts, que es lo que hacía titilar/crashear). */
export async function getGpsPermission(): Promise<GpsPermissionStatus> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED ? 'otorgado' : 'denegado';
}

export function hasLocationServicesEnabled(): Promise<boolean> {
  return Location.hasServicesEnabledAsync();
}

/**
 * Dispara el diálogo del SO que corresponde para destrabar el GPS:
 * - Permiso de la app: re-pregunta; si quedó denegado permanente ("no volver a
 *   preguntar"), salta a los Ajustes de la app.
 * - GPS del dispositivo apagado: diálogo nativo de activación (Android); si el
 *   usuario lo rechaza o falla, salta a los Ajustes.
 */
export async function openGpsUnblockDialog(
  reason: 'permiso' | 'gps-apagado',
): Promise<void> {
  if (reason === 'permiso') {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED && !canAskAgain) {
      await Linking.openSettings();
    }
    return;
  }
  try {
    await Location.enableNetworkProviderAsync();
  } catch {
    await Linking.openSettings();
  }
}

/**
 * Pide un fix fresco en el momento (usado al tap cuando el último fix del
 * watcher quedó viejo). Devuelve null si no resuelve dentro del timeout o
 * si el provider falla: el llamador nunca se bloquea.
 */
export async function getCurrentGpsFix(
  timeoutMs: number = GPS_FIX_REQUEST_TIMEOUT_MS,
): Promise<GpsFix | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
      timeout,
    ]);
    return location ? toGpsFix(location) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Arranca el watcher en máxima frecuencia/precisión (árboles a < 1 m entre sí). */
export function watchGpsPosition(
  onFix: (fix: GpsFix) => void,
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: GPS_WATCHER_TIME_INTERVAL_MS,
      distanceInterval: GPS_WATCHER_DISTANCE_INTERVAL_METERS,
    },
    (location) => onFix(toGpsFix(location)),
  );
}
