/** Cambio pendiente sobre una especie de la plantación: discrimina `cambios_especies_pendientes` (#635). */
export const CAMBIO_DE_ESPECIE = {
  alta: 'alta',
  baja: 'baja',
} as const;

export type CambioDeEspecie = (typeof CAMBIO_DE_ESPECIE)[keyof typeof CAMBIO_DE_ESPECIE];
