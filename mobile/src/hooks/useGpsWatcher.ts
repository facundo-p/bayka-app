import type { LocationSubscription } from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getGpsPermission,
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
  /** Re-chequea permiso/servicios sin abrir diálogo y arranca el watcher si corresponde (ej. tras destrabar GPS desde Ajustes del SO). */
  refresh: () => void;
}

/**
 * Mantiene el GPS caliente mientras la pantalla está enfocada, expone el último fix; degrada sin
 * error si no hay permiso o el GPS está apagado (el bloqueo por obligatoriedad lo decide useGpsGate).
 * Crash-safety (#115): el permiso se pide una sola vez con diálogo; al volver del background se
 * re-chequea sin diálogo y NO se reinicia un watcher ya corriendo (si no, cada 'active' reiniciaba
 * el watcher y re-pedía permiso en ráfaga).
 * `enabled` (#120/#121): desactivada, no corre ni pide permiso; al reactivarla enfocada, re-arranca pidiendo permiso una vez.
 */
export function useGpsWatcher(enabled: boolean = true): UseGpsWatcherResult {
  const [lastFix, setLastFix] = useState<GpsFix | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<GpsPermissionStatus>('pendiente');
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);

  const lastFixRef = useRef<GpsFix | null>(null);
  const subscriptionRef = useRef<LocationSubscription | null>(null);
  const focusedRef = useRef(false);
  const startingRef = useRef(false); // evita ejecuciones concurrentes (AppState + refresh)
  const promptedRef = useRef(false); // el diálogo de permiso se muestra una sola vez
  const enabledRef = useRef(enabled); // lectura del valor vigente dentro de ensureWatching

  const getLastFix = useCallback(() => lastFixRef.current, []);

  const stopWatching = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  /** Arranca el watcher si hay permiso+servicios y no está corriendo. `prompt` true solo al enfocar (pide con diálogo); en resume es false (lee sin diálogo). */
  const ensureWatching = useCallback(async (prompt: boolean) => {
    if (!enabledRef.current) {
      stopWatching();
      return;
    }
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const permission = prompt && !promptedRef.current
        ? await requestGpsPermission()
        : await getGpsPermission();
      if (prompt) promptedRef.current = true;
      if (!focusedRef.current) return;
      setPermissionStatus(permission);

      const enabled = await hasLocationServicesEnabled();
      if (!focusedRef.current) return;
      setServicesEnabled(enabled);

      if (permission !== 'otorgado' || !enabled) {
        stopWatching();
        return;
      }
      if (subscriptionRef.current) return; // ya corriendo: NO reiniciar (evita titileo)

      const subscription = await watchGpsPosition((fix) => {
        lastFixRef.current = fix;
        setLastFix(fix);
      });
      if (!focusedRef.current) subscription.remove();
      else subscriptionRef.current = subscription;
    } catch (e) {
      gpsLog.error('watcher no pudo iniciar', e);
    } finally {
      startingRef.current = false;
    }
  }, [stopWatching]);

  const refresh = useCallback(() => {
    void ensureWatching(false);
  }, [ensureWatching]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      void ensureWatching(true);
      const appStateListener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void ensureWatching(false);
      });
      return () => {
        focusedRef.current = false;
        appStateListener.remove();
        stopWatching();
      };
    }, [ensureWatching, stopWatching]),
  );

  // useFocusEffect no re-corre por cambio de prop; este effect reacciona al toggle de `enabled` (ver doc del hook).
  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      stopWatching();
      lastFixRef.current = null;
      setLastFix(null);
      setPermissionStatus('pendiente');
      setServicesEnabled(null);
      promptedRef.current = false;
    } else if (focusedRef.current) {
      void ensureWatching(true);
    }
  }, [enabled, stopWatching, ensureWatching]);

  return { lastFix, getLastFix, permissionStatus, servicesEnabled, refresh };
}
