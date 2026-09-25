import { ESTADO_PLANTACION, ESTADO_GRUPO, esArchivada, esEliminadaEnServidor } from '../constants/estados';

/** Lo que decide si una plantación admite cambios desde la app. */
export interface EstadoDeEdicionDePlantacion {
  estado: string;
  archivadaEn: string | null;
  eliminadaEnServidorEn: string | null;
}

/** Quién intenta editar: rol de admin o superadmin, y userId de la sesión. */
export interface EditorDeParcela {
  esAdmin: boolean;
  userId: string | null;
}

/** El servidor todavía no la tiene: no hay copia de la que recuperarla. */
export function nuncaSubida(parcela: { altaPendienteDe: string | null }): boolean {
  return parcela.altaPendienteDe != null;
}

/** La parcela la creó `userId` en este dispositivo y su alta todavía no llegó al servidor. */
export function esAltaPropiaSinSubir(parcela: { altaPendienteDe: string | null }, userId: string | null): boolean {
  return userId != null && parcela.altaPendienteDe === userId;
}

/**
 * Editar y borrar una parcela es de admin y superadmin (#640), salvo la que el técnico
 * creó y todavía no subió: el servidor nunca la vio y el push la sube como alta (#654).
 * Único predicado para esa regla: lo usan `ParcelaRepository` y las pantallas.
 */
export function puedeEditarParcela(parcela: { altaPendienteDe: string | null }, editor: EditorDeParcela): boolean {
  return editor.esAdmin || esAltaPropiaSinSubir(parcela, editor.userId);
}

/**
 * Una plantación finalizada es inmutable desde la app: ni ediciones ni borrados,
 * propios o ajenos (#469). Reabrirla es exclusivo del superadmin y requiere conexión (#470, #637).
 * Archivada o eliminada en el servidor tampoco admiten cambios, para ningún rol (#477, #478).
 */
export function plantacionEsEditable(plantacion: EstadoDeEdicionDePlantacion): boolean {
  return (
    !esEliminadaEnServidor(plantacion) &&
    !esArchivada(plantacion) &&
    plantacion.estado !== ESTADO_PLANTACION.finalizada
  );
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
