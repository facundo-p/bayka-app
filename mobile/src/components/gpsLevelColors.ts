import type { GpsSignalLevel } from '../services/gps/signalLevel';
import { colors } from '../theme';

/** Color de cada nivel del semáforo GPS (compartido por los indicadores). */
export const GPS_LEVEL_COLOR: Record<GpsSignalLevel, string> = {
  buena: colors.gpsGood,
  regular: colors.gpsRegular,
  mala: colors.gpsBad,
  'sin-senal': colors.gpsNone,
};
