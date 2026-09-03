/** Configuración de la captura GPS en el registro de árboles — único lugar donde viven estos parámetros. */

/** Cada cuántos árboles se captura GPS si la plantación no define otro valor. Duplicado a propósito en migración 0015 (schema local) y 023 (Supabase); si cambia, revisar esos defaults. */
export const GPS_CAPTURE_FREQUENCY_DEFAULT = 10;

/** Si una plantación exige captura GPS por default. Mismo trato que la frecuencia: duplicado en migración 0015 (`1`) y 023 (`true`); si cambia, revisar esos defaults. */
export const GPS_CAPTURE_REQUIRED_DEFAULT = true;

/** Umbrales del semáforo de precisión, en metros. */
export const GPS_ACCURACY_GOOD_MAX_METERS = 3; // verde: precisión ≤ 3 m
export const GPS_ACCURACY_REGULAR_MAX_METERS = 8; // amarillo: ≤ 8 m; rojo: > 8 m

/** Edad máxima (ms) de un fix del watcher para usarlo al tap; más viejo → se pide un fix fresco en el instante del registro. */
export const GPS_FIX_MAX_AGE_MS = 2_000;

/** Tiempo máximo (ms) de espera por el fix fresco pedido al tap; vencido, el árbol queda sin coordenadas (el alta nunca se bloquea). */
export const GPS_FIX_REQUEST_TIMEOUT_MS = 15_000;

/** Edad (ms) a partir de la cual el indicador de señal considera el fix perdido y se muestra en gris ("sin señal"). */
export const GPS_FIX_STALE_MS = 10_000;

/** Cada cuánto (ms) re-evalúa el indicador la edad del fix (si no, el semáforo quedaría verde para siempre sin fixes nuevos). */
export const GPS_SIGNAL_UI_REFRESH_MS = 1_000;

/** Config del watcher: mantiene el GPS caliente para el semáforo (la precisión al tap la resuelve `getCurrentGpsFix`). Frecuencia 0 inundaba el bridge y causaba el crash de inicio (#115); 1s alcanza. */
export const GPS_WATCHER_TIME_INTERVAL_MS = 1_000;
export const GPS_WATCHER_DISTANCE_INTERVAL_METERS = 0;
