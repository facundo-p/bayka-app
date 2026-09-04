import { ESTADO_PLANTACION, ESTADO_GRUPO } from '../constants/estados';

/**
 * Permisos del detalle/edición de árbol:
 * - Plantación finalizada o usuario no-creador → sólo lectura.
 * - Grupo activo + plantación activa + creador → editar foto/GPS y eliminar.
 * - Grupo finalizado + plantación activa + creador → editar foto/GPS, sin eliminar.
 */
export interface TreeEditGating {
  canEdit: boolean;
  canDelete: boolean;
}

export function getTreeEditGating(params: {
  plantacionEstado: string;
  subgroupEstado: string;
  isCreator: boolean;
}): TreeEditGating {
  const canEdit = params.plantacionEstado !== ESTADO_PLANTACION.finalizada && params.isCreator;
  const canDelete = canEdit && params.subgroupEstado === ESTADO_GRUPO.activa;
  return { canEdit, canDelete };
}
