import {
  GPS_CAPTURE_FREQUENCY_DEFAULT,
  GPS_FIX_MAX_AGE_MS,
} from '../../constants/gpsCapture';
import type { GpsFix } from './locationClient';

/**
 * Regla determinística por posición: se captura GPS si la posición cae en el
 * inicio de cada bloque de N árboles. Con N=10 captura 1, 11, 21… (siempre el
 * árbol 1 de cada grupo, ancla geográfica). Sobrevive reinicios y "Deshacer"
 * porque depende solo de la posición persistida, no de contadores en memoria.
 */
export function shouldCaptureGps(posicion: number, frequency: number): boolean {
  const effectiveFrequency =
    Number.isInteger(frequency) && frequency >= 1 ? frequency : GPS_CAPTURE_FREQUENCY_DEFAULT;
  return (posicion - 1) % effectiveFrequency === 0;
}

/** Un fix del watcher solo sirve al tap si es esencialmente actual (≤ ~2 s). */
export function isFixFresh(fix: GpsFix | null, tapAtMs: number): fix is GpsFix {
  return fix !== null && tapAtMs - fix.timestamp <= GPS_FIX_MAX_AGE_MS;
}
