/**
 * Configuración de la captura GPS en el registro de árboles.
 * Único lugar donde viven estos parámetros: el resto del código los importa
 * y nunca repite los números.
 */

/** Cada cuántos árboles se captura GPS si la plantación no define otro valor.
 *  Duplicado a propósito en los DEFAULT de schema local (migración 0015) y
 *  Supabase (migración 023): si cambia acá, revisar esos defaults. */
export const GPS_CAPTURE_FREQUENCY_DEFAULT = 10;

/** Si una plantación exige captura GPS cuando no se definió lo contrario.
 *  Mismo trato que la frecuencia: duplicado en los DEFAULT de schema local
 *  (migración 0015: `1`) y Supabase (migración 023: `true`); si cambia acá,
 *  revisar esos defaults. */
export const GPS_CAPTURE_REQUIRED_DEFAULT = true;

/** Umbrales del semáforo de precisión, en metros. */
export const GPS_ACCURACY_GOOD_MAX_METERS = 3; // verde: precisión ≤ 3 m
export const GPS_ACCURACY_REGULAR_MAX_METERS = 8; // amarillo: ≤ 8 m; rojo: > 8 m

/** Edad máxima (ms) de un fix del watcher para usarlo al momento del tap.
 *  Más viejo que esto → se pide un fix fresco en el instante del registro. */
export const GPS_FIX_MAX_AGE_MS = 2_000;

/** Tiempo máximo (ms) de espera por el fix fresco pedido al tap.
 *  Vencido, el árbol queda sin coordenadas (el alta nunca se bloquea). */
export const GPS_FIX_REQUEST_TIMEOUT_MS = 15_000;

/** Edad (ms) a partir de la cual el indicador de señal considera el fix
 *  perdido y se muestra en gris ("sin señal"). */
export const GPS_FIX_STALE_MS = 10_000;

/** Cada cuánto (ms) re-evalúa el indicador la edad del fix (si dejan de
 *  llegar fixes, nada re-renderiza y el semáforo quedaría verde para siempre). */
export const GPS_SIGNAL_UI_REFRESH_MS = 1_000;

/** Configuración del watcher: máxima frecuencia y precisión posibles, porque
 *  en plantaciones densas los árboles distan menos de 1 m entre sí. */
export const GPS_WATCHER_TIME_INTERVAL_MS = 0;
export const GPS_WATCHER_DISTANCE_INTERVAL_METERS = 0;
