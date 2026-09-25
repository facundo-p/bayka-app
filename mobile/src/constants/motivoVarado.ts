/**
 * Por qué lo pendiente de una plantación no puede subir hasta que algo cambie en el
 * server (#638). Solo local: lo guarda el sync en `plantations.motivo_varado`, salvo
 * eliminada, que sale de `eliminada_en_servidor_en`.
 */
export const MOTIVO_VARADO = {
  eliminada: 'eliminada',
  archivada: 'archivada',
  finalizada: 'finalizada',
  sinPermiso: 'sin-permiso',
} as const;

export type MotivoVarado = (typeof MOTIVO_VARADO)[keyof typeof MOTIVO_VARADO];

/** Con más de un motivo en la misma corrida gana el primero. */
export const PRIORIDAD_DE_MOTIVOS: readonly MotivoVarado[] = [
  MOTIVO_VARADO.eliminada,
  MOTIVO_VARADO.archivada,
  MOTIVO_VARADO.finalizada,
  MOTIVO_VARADO.sinPermiso,
];

/** Motivos que dependen solo del estado de la plantación: ver que es escribible alcanza para limpiarlos. */
export const MOTIVOS_DEL_ESTADO: readonly MotivoVarado[] = [MOTIVO_VARADO.archivada, MOTIVO_VARADO.finalizada];
