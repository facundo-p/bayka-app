/** Estados de plantación — contrato con contracts/estados.json (fuente de verdad; runtime y contrato cambian juntos). */
export const ESTADO_PLANTACION = {
  activa: 'activa',
  finalizada: 'finalizada',
} as const;

export type EstadoPlantacion = (typeof ESTADO_PLANTACION)[keyof typeof ESTADO_PLANTACION];

/** Estados de grupo: superset de ESTADO_PLANTACION + 'sincronizada', flag solo-cliente sin
 *  contraparte server (el server la mapea a 'finalizada'; por eso no vive en el contrato). */
export const ESTADO_GRUPO = {
  ...ESTADO_PLANTACION,
  sincronizada: 'sincronizada',
} as const;

export type EstadoGrupo = (typeof ESTADO_GRUPO)[keyof typeof ESTADO_GRUPO];
