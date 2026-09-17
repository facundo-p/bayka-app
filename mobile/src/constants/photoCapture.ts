/** Configuración de la captura de foto en la botonera de registro (#439) — único lugar donde viven estos parámetros. */

/** Si la plantación pide foto en todos los botones de especie (no solo N/N) cuando no define otro valor. Duplicado a propósito en migración 0019 (schema local, `0`) y 035 (Supabase, `false`); si cambia, revisar esos defaults. */
export const PHOTO_CAPTURE_ALL_TREES_DEFAULT = false;

/** Si la foto de un árbol identificado es obligatoria cuando la plantación pide foto en todos los botones. Hoy es constante; el día que sea configurable por plantación pasa a ser el DEFAULT de esa columna (como GPS_CAPTURE_REQUIRED_DEFAULT). N/N no la usa: su foto es obligatoria siempre. */
export const PHOTO_CAPTURE_REQUIRED_DEFAULT = true;
