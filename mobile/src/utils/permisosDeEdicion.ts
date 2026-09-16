import { ESTADO_PLANTACION, ESTADO_GRUPO } from '../constants/estados';

/**
 * Una plantación finalizada es inmutable desde la app: ni ediciones ni borrados,
 * propios o ajenos (#469). Reabrirla es exclusivo del superadmin, desde la web (#470).
 */
export function plantacionEsEditable(plantacionEstado: string): boolean {
  return plantacionEstado !== ESTADO_PLANTACION.finalizada;
}

/**
 * Permisos sobre los árboles de un grupo:
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
  const canEdit = plantacionEsEditable(params.plantacionEstado) && params.isCreator;
  const canDelete = canEdit && params.subgroupEstado === ESTADO_GRUPO.activa;
  return { canEdit, canDelete };
}

/**
 * Permisos sobre el grupo como entidad —renombrar, eliminar, reactivar—, que son
 * otra cosa que los permisos sobre sus árboles: reactivar solo aplica a un grupo
 * ya finalizado, donde no se puede editar ni eliminar.
 */
export interface GroupGating {
  canEdit: boolean;
  canDelete: boolean;
  canReactivate: boolean;
}

export function getGroupGating(params: {
  plantacionEstado: string;
  subgroupEstado: string;
  isCreator: boolean;
}): GroupGating {
  const habilitado = plantacionEsEditable(params.plantacionEstado) && params.isCreator;
  const sobreGrupoActivo = habilitado && params.subgroupEstado === ESTADO_GRUPO.activa;
  return {
    canEdit: sobreGrupoActivo,
    canDelete: sobreGrupoActivo,
    canReactivate: habilitado && params.subgroupEstado === ESTADO_GRUPO.finalizada,
  };
}

/** Ningún permiso: para cuando todavía no se sabe el estado de la plantación. */
export const SIN_PERMISOS_DE_GRUPO: GroupGating = {
  canEdit: false,
  canDelete: false,
  canReactivate: false,
};
