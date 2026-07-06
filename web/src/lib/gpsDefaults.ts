/**
 * Defaults de la captura GPS de una plantación. El origen de estos valores es
 * mobile/src/constants/gpsCapture.ts (GPS_CAPTURE_FREQUENCY_DEFAULT y
 * GPS_CAPTURE_REQUIRED_DEFAULT): la web no comparte código con mobile, así
 * que se duplican acá a propósito. Si cambian allá, actualizar acá y los
 * DEFAULT de la migración 023 de Supabase.
 */

/** Cada cuántos árboles se captura GPS si la plantación no define otro valor. */
export const GPS_CAPTURE_FREQUENCY_DEFAULT = 10;

/** Si la captura GPS es obligatoria cuando la plantación no definió lo contrario. */
export const GPS_CAPTURE_REQUIRED_DEFAULT = true;
