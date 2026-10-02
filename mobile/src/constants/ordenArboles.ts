/** Orden del listado de árboles de un grupo (solo vista; no cambia las posiciones). */
export const ORDEN_ARBOLES = {
  ascendente: 'asc',
  descendente: 'desc',
} as const;

export type OrdenArboles = (typeof ORDEN_ARBOLES)[keyof typeof ORDEN_ARBOLES];
