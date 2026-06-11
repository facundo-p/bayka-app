import type { LocationSubscription } from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import {
  GpsFix,
  GpsPermissionStatus,
  hasLocationServicesEnabled,
  requestGpsPermission,
  watchGpsPosition,
} from '../services/gps/locationClient';
import { gpsLog } from '../utils/gpsLogger';

export interface UseGpsWatcherResult {
  /** Último fix recibido del watcher; null hasta el primer fix. */
  lastFix: GpsFix | null;
  /** Lectura estable del último fix (no re-renderiza): para usar en callbacks. */
  getLastFix: () => GpsFix | null;
  permissionStatus: GpsPermissionStatus;
  /** null mientras no se chequeó; false = GPS del dispositivo apagado. */
  servicesEnabled: boolean | null;
}

interface WatcherSession {
  cancelled: boolean;
  subscription: LocationSubscription | null;
}

/**
 * Mantiene el GPS caliente mientras la pantalla está enfocada (se detiene al
 * salir, por batería) y expone el último fix. Degrada sin errores si el
 * permiso se deniega o el GPS está apagado: ningún flujo se bloquea.
 */
export function useGpsWatcher(): UseGpsWatcherResult {
  const [lastFix, setLastFix] = useState<GpsFix | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<GpsPermissionStatus>('pendiente');
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const lastFixRef = useRef<GpsFix | null>(null);
  const getLastFix = useCallback(() => lastFixRef.current, []);

  const startSession = useCallback(async (session: WatcherSession) => {
    const permission = await requestGpsPermission();
    if (session.cancelled) return;
    setPermissionStatus(permission);

    const enabled = await hasLocationServicesEnabled();
    if (session.cancelled) return;
    setServicesEnabled(enabled);
    if (permission !== 'otorgado' || !enabled) return;

    const subscription = await watchGpsPosition((fix) => {
      if (session.cancelled) return;
      lastFixRef.current = fix;
      setLastFix(fix);
    });
    // El focus pudo perderse mientras el watcher arrancaba.
    if (session.cancelled) subscription.remove();
    else session.subscription = subscription;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const session: WatcherSession = { cancelled: false, subscription: null };
      startSession(session).catch((e) => gpsLog.error('watcher no pudo iniciar', e));
      return () => {
        session.cancelled = true;
        session.subscription?.remove();
      };
    }, [startSession]),
  );

  return { lastFix, getLastFix, permissionStatus, servicesEnabled };
}
