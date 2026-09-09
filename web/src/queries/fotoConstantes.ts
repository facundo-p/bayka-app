/**
 * Esquemas de archivo local de mobile: la foto está en el dispositivo y todavía
 * no se subió al bucket. Vive acá y no en `services/fotoService` porque también
 * lo necesita el filtro de árboles por foto, y si los dos criterios divergen la
 * columna "Foto" de la tabla dejaría de coincidir con el filtro.
 */
export const ESQUEMAS_FOTO_LOCAL = ['file://', 'content://'] as const;
