import { useCallback, useState } from 'react';

import { getGpsGateState, GPS_GATE_MESSAGES, GpsGateState } from '../services/gps/gateRules';
import { GpsPermissionStatus, openGpsUnblockDialog } from '../services/gps/locationClient';
import { gpsLog } from '../utils/gpsLogger';

export interface UseGpsGateParams {
  /** Obligatoriedad de captura GPS de la plantación. */
  required: boolean;
  permissionStatus: GpsPermissionStatus;
  servicesEnabled: boolean | null;
  /** Re-chequeo del watcher tras intentar destrabar (useGpsWatcher.refresh). */
  refreshWatcher: () => void;
}

export interface UseGpsGateResult {
  state: GpsGateState;
  blocked: boolean;
  /** Mensaje para el usuario cuando está bloqueada; null si habilitada. */
  message: string | null;
  /** true mientras el diálogo del SO está resolviéndose (deshabilitar botón). */
  unblocking: boolean;
  /** Dispara el diálogo del SO correspondiente y re-chequea el estado. */
  requestUnblock: () => Promise<void>;
}

/**
 * Gating de la botonera de registro cuando la plantación exige captura GPS:
 * bloquea solo el alta de árboles (el resto de la pantalla sigue operativa) y
 * destraba con los diálogos del SO. Si la obligatoriedad cambia por pull con
 * la pantalla abierta, el estado se recalcula solo (params reactivos).
 */
export function useGpsGate({
  required,
  permissionStatus,
  servicesEnabled,
  refreshWatcher,
}: UseGpsGateParams): UseGpsGateResult {
  const [unblocking, setUnblocking] = useState(false);

  const state = getGpsGateState(required, permissionStatus, servicesEnabled);
  const blocked = state !== 'habilitada';
  const message = blocked ? GPS_GATE_MESSAGES[state] : null;

  const requestUnblock = useCallback(async () => {
    if (unblocking) return;
    setUnblocking(true);
    try {
      const current = getGpsGateState(required, permissionStatus, servicesEnabled);
      if (current === 'habilitada') return;
      await openGpsUnblockDialog(current === 'bloqueada-permiso' ? 'permiso' : 'gps-apagado');
      refreshWatcher();
    } catch (e) {
      gpsLog.error('no se pudo destrabar el GPS', e);
    } finally {
      setUnblocking(false);
    }
  }, [unblocking, required, permissionStatus, servicesEnabled, refreshWatcher]);

  return { state, blocked, message, unblocking, requestUnblock };
}
