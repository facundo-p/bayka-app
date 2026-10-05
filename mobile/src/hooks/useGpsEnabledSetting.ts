import { preferenciaGps } from '../services/settings/gpsEnabledStore';
import { usePreferencia } from './usePreferencia';

/** Preferencia local (por dispositivo) de medición de GPS in-app. */
export function useGpsEnabledSetting() {
  const gpsEnabled = usePreferencia(preferenciaGps);
  return { gpsEnabled, setGpsEnabled: preferenciaGps.set };
}
