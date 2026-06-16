/**
 * Permisos del detalle/edición de árbol (issue #155).
 *
 * - Plantación finalizada **o** usuario no-creador → sólo lectura.
 * - Grupo activo + plantación activa + creador → editar foto/GPS **y** eliminar.
 * - Grupo finalizado + plantación activa + creador → editar foto/GPS, **sin** eliminar.
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
  const canEdit = params.plantacionEstado !== 'finalizada' && params.isCreator;
  const canDelete = canEdit && params.subgroupEstado === 'activa';
  return { canEdit, canDelete };
}
