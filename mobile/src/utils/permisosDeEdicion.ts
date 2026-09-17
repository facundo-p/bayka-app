import { ESTADO_PLANTACION, ESTADO_GRUPO, esArchivada } from '../constants/estados';

/** Lo que decide si una plantación admite cambios desde la app. */
export interface EstadoDeEdicionDePlantacion {
  estado: string;
  archivadaEn: string | null;
}

/**
 * Una plantación finalizada es inmutable desde la app: ni ediciones ni borrados,
 * propios o ajenos (#469). Reabrirla es exclusivo del superadmin, desde la web (#470).
 * Archivada tampoco admite cambios, para ningún rol (#477).
 */
export function plantacionEsEditable(plantacion: EstadoDeEdicionDePlantacion): boolean {
  return !esArchivada(plantacion) && plantacion.estado !== ESTADO_PLANTACION.finalizada;
}

/**
 * Permisos sobre los árboles de un grupo:
 * - Plantación no editable o usuario no-creador → sólo lectura.
 * - Grupo activo + plantación editable + creador → editar foto/GPS y eliminar.
 * - Grupo finalizado + plantación editable + creador → editar foto/GPS, sin eliminar.
 */
export interface TreeEditGating {
  canEdit: boolean;
  canDelete: boolean;
}

export function getTreeEditGating(params: {
  plantacion: EstadoDeEdicionDePlantacion;
  subgroupEstado: string;
  isCreator: boolean;
}): TreeEditGating {
  const canEdit = plantacionEsEditable(params.plantacion) && params.isCreator;
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
  plantacion: EstadoDeEdicionDePlantacion;
  subgroupEstado: string;
  isCreator: boolean;
}): GroupGating {
  const habilitado = plantacionEsEditable(params.plantacion) && params.isCreator;
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
