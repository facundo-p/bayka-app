import type { LocationSubscription } from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

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
  /** Re-chequea permiso/servicios y reinicia el watcher (ej. tras destrabar GPS). */
  refresh: () => void;
}

interface WatcherSession {
  cancelled: boolean;
  subscription: LocationSubscription | null;
}

/**
 * Mantiene el GPS caliente mientras la pantalla está enfocada (se detiene al
 * salir, por batería) y expone el último fix. Degrada sin errores si el
 * permiso se deniega o el GPS está apagado: ningún flujo se bloquea acá (el
 * bloqueo por obligatoriedad lo decide useGpsGate). Al volver del background
 * (ej. desde Ajustes del SO) re-chequea permiso/servicios en caliente.
 */
export function useGpsWatcher(): UseGpsWatcherResult {
  const [lastFix, setLastFix] = useState<GpsFix | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<GpsPermissionStatus>('pendiente');
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const lastFixRef = useRef<GpsFix | null>(null);
  const sessionRef = useRef<WatcherSession | null>(null);
  const getLastFix = useCallback(() => lastFixRef.current, []);

  const stopSession = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.cancelled = true;
    sessionRef.current.subscription?.remove();
    sessionRef.current = null;
  }, []);

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

  const refresh = useCallback(() => {
    stopSession();
    const session: WatcherSession = { cancelled: false, subscription: null };
    sessionRef.current = session;
    startSession(session).catch((e) => gpsLog.error('watcher no pudo iniciar', e));
  }, [startSession, stopSession]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const appStateListener = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        appStateListener.remove();
        stopSession();
      };
    }, [refresh, stopSession]),
  );

  return { lastFix, getLastFix, permissionStatus, servicesEnabled, refresh };
}
