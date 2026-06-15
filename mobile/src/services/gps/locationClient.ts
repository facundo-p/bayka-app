import * as Location from 'expo-location';

import {
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

export function hasLocationServicesEnabled(): Promise<boolean> {
  return Location.hasServicesEnabledAsync();
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
