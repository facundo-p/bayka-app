/**
 * Qué dato chocó al sincronizar (#795): cambió en el teléfono y en el servidor desde
 * la última vez que el teléfono lo vio. Discrimina las filas de `conflictos_de_sync`.
 *
 * Los de grupo son también las claves de `base` y de `conservados.grupo` en el
 * contrato de `sync_subgroup` (075): renombrarlos rompe la detección.
 */
export const CAMPO_EN_CONFLICTO = {
  especie: 'especie',
  gps: 'gps',
  foto: 'foto',
  nombre: 'nombre',
  codigo: 'codigo',
  tipo: 'tipo',
  estado: 'estado',
} as const;

export type CampoEnConflicto = (typeof CAMPO_EN_CONFLICTO)[keyof typeof CAMPO_EN_CONFLICTO];

/** Los datos del grupo que el servidor conserva si difieren de la base. */
export const CAMPOS_DE_GRUPO = [
  CAMPO_EN_CONFLICTO.nombre,
  CAMPO_EN_CONFLICTO.codigo,
  CAMPO_EN_CONFLICTO.tipo,
  CAMPO_EN_CONFLICTO.estado,
] as const;

export type CampoDeGrupo = (typeof CAMPOS_DE_GRUPO)[number];

export const esCampoDeGrupo = (campo: CampoEnConflicto): campo is CampoDeGrupo =>
  (CAMPOS_DE_GRUPO as readonly CampoEnConflicto[]).includes(campo);

/** Por qué no se pudo resolver un conflicto, además de los rechazos de edición. */
export const ERROR_DE_CONFLICTO = {
  /** Ya se resolvió, o el árbol o el grupo ya no están. */
  inexistente: 'conflicto_inexistente',
  /** Lo propio no se puede volver a aplicar: un N/N, un punto incompleto, un estado desconocido. */
  sinValor: 'conflicto_sin_valor',
} as const;

export type ErrorDeConflicto = (typeof ERROR_DE_CONFLICTO)[keyof typeof ERROR_DE_CONFLICTO];
