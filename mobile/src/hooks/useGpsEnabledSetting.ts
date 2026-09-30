import { preferenciaGps } from '../services/settings/gpsEnabledStore';
import { usePreferenciaBooleana } from './usePreferenciaBooleana';

/** Preferencia local (por dispositivo) de medición de GPS in-app. */
export function useGpsEnabledSetting() {
  const gpsEnabled = usePreferenciaBooleana(preferenciaGps);
  return { gpsEnabled, setGpsEnabled: preferenciaGps.set };
}
