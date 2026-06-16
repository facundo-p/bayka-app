import type { GpsPermissionStatus } from './locationClient';

/**
 * Estado de la botonera de registro según la obligatoriedad de captura GPS.
 * 'bloqueada-permiso' incluye el permiso aún no resuelto ('pendiente'): con
 * permiso ya otorgado el request resuelve al instante y no se ve el bloqueo.
 */
export type GpsGateState = 'habilitada' | 'bloqueada-permiso' | 'bloqueada-gps-apagado';

export function getGpsGateState(
  required: boolean,
  permissionStatus: GpsPermissionStatus,
  servicesEnabled: boolean | null,
): GpsGateState {
  if (!required) return 'habilitada';
  if (permissionStatus !== 'otorgado') return 'bloqueada-permiso';
  if (servicesEnabled === false) return 'bloqueada-gps-apagado';
  return 'habilitada';
}

export const GPS_GATE_MESSAGES: Record<Exclude<GpsGateState, 'habilitada'>, string> = {
  'bloqueada-permiso':
    'Esta plantación exige capturar GPS al registrar árboles. Otorgá el permiso de ubicación para continuar.',
  'bloqueada-gps-apagado':
    'Esta plantación exige capturar GPS al registrar árboles. Encendé la ubicación del dispositivo para continuar.',
};
