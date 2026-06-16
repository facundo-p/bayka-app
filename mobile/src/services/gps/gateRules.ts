import type { GpsPermissionStatus } from './locationClient';

/**
 * Estado de la botonera de registro según la obligatoriedad de captura GPS.
 * 'bloqueada-medicion-off' tiene precedencia: si el usuario desactivó la
 * medición de GPS in-app (Ajustes), se destraba activándola, no con un diálogo
 * del SO. 'bloqueada-permiso' incluye el permiso aún no resuelto ('pendiente').
 */
export type GpsGateState =
  | 'habilitada'
  | 'bloqueada-medicion-off'
  | 'bloqueada-permiso'
  | 'bloqueada-gps-apagado';

export function getGpsGateState(
  required: boolean,
  gpsEnabled: boolean,
  permissionStatus: GpsPermissionStatus,
  servicesEnabled: boolean | null,
): GpsGateState {
  if (!required) return 'habilitada';
  if (!gpsEnabled) return 'bloqueada-medicion-off';
  if (permissionStatus !== 'otorgado') return 'bloqueada-permiso';
  if (servicesEnabled === false) return 'bloqueada-gps-apagado';
  return 'habilitada';
}

export const GPS_GATE_MESSAGES: Record<Exclude<GpsGateState, 'habilitada'>, string> = {
  'bloqueada-medicion-off':
    'Esta plantación exige capturar GPS al registrar árboles. Activá la medición de GPS para continuar.',
  'bloqueada-permiso':
    'Esta plantación exige capturar GPS al registrar árboles. Otorgá el permiso de ubicación para continuar.',
  'bloqueada-gps-apagado':
    'Esta plantación exige capturar GPS al registrar árboles. Encendé la ubicación del dispositivo para continuar.',
};
