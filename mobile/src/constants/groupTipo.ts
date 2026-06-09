/**
 * Tipos de grupo: única fuente de verdad de valores, default y labels.
 * El valor (`GROUP_TIPO.*`) se persiste en DB — cambiarlo requiere migración.
 * El label (`GROUP_TIPO_LABELS`) es solo presentación.
 */
export const GROUP_TIPO = {
  LINEA: 'linea',
  BOSQUETE: 'bosquete',
} as const;

export type GroupTipo = (typeof GROUP_TIPO)[keyof typeof GROUP_TIPO];

export const GROUP_TIPO_DEFAULT: GroupTipo = GROUP_TIPO.LINEA;

export const GROUP_TIPO_LABELS: Record<GroupTipo, string> = {
  [GROUP_TIPO.LINEA]: 'Línea',
  [GROUP_TIPO.BOSQUETE]: 'Bosquete',
};
