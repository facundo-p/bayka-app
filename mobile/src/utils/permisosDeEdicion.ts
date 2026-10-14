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

/** Quién mira un grupo: si lo creó, y si tiene rol de admin o superadmin. */
export interface EditorDelGrupo {
  plantacion: EstadoDeEdicionDePlantacion;
  isCreator: boolean;
  esAdmin: boolean;
}

/**
 * Foto, GPS y N/N de los árboles: el creador del grupo, o admin y superadmin en
 * cualquier grupo (#768), siempre con la plantación editable. El server aplica la misma regla.
 */
export function puedeEditarArbolesDelGrupo(params: EditorDelGrupo): boolean {
  return plantacionEsEditable(params.plantacion) && (params.isCreator || params.esAdmin);
}

/** Registrar, borrar árboles y todo lo del grupo como entidad: solo su creador, con la plantación editable. */
export function esEdicionPropia(params: { plantacion: EstadoDeEdicionDePlantacion; isCreator: boolean }): boolean {
  return plantacionEsEditable(params.plantacion) && params.isCreator;
}

/**
 * Permisos sobre los árboles de un grupo:
 * - Plantación no editable → sólo lectura.
 * - Creador, o admin en un grupo ajeno → editar foto/GPS.
 * - Eliminar: solo el creador, con el grupo activo.
 */
export interface TreeEditGating {
  canEdit: boolean;
  canDelete: boolean;
}

export function getTreeEditGating(params: EditorDelGrupo & { subgroupEstado: string }): TreeEditGating {
  return {
    canEdit: puedeEditarArbolesDelGrupo(params),
    canDelete: esEdicionPropia(params) && params.subgroupEstado === ESTADO_GRUPO.activa,
  };
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
  const habilitado = esEdicionPropia(params);
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

/** Qué ofrece el detalle de un árbol para cambiar su especie (#679). */
export const CAMBIO_DE_ESPECIE = {
  disponible: 'disponible',
  /** Grupo finalizado: el botón se ve grisado y, al tocarlo, ofrece reabrir el grupo. */
  requiereReabrir: 'requiere-reabrir',
  noDisponible: 'no-disponible',
} as const;

export type CambioDeEspecie = (typeof CAMBIO_DE_ESPECIE)[keyof typeof CAMBIO_DE_ESPECIE];

/**
 * Cambia la especie el creador, con el grupo activo; un admin en un grupo ajeno, no
 * (#768). En uno finalizado, solo si además puede reabrirlo: reabrir y cambiar es una sola tarea.
 */
export function getCambioDeEspecie(params: {
  plantacion: EstadoDeEdicionDePlantacion;
  subgroupEstado: string;
  isCreator: boolean;
}): CambioDeEspecie {
  if (!esEdicionPropia(params)) return CAMBIO_DE_ESPECIE.noDisponible;
  if (params.subgroupEstado === ESTADO_GRUPO.activa) return CAMBIO_DE_ESPECIE.disponible;
  return getGroupGating(params).canReactivate ? CAMBIO_DE_ESPECIE.requiereReabrir : CAMBIO_DE_ESPECIE.noDisponible;
}

export const seOfreceCambioDeEspecie = (cambio: CambioDeEspecie) => cambio !== CAMBIO_DE_ESPECIE.noDisponible;

export const cambioRequiereReabrir = (cambio: CambioDeEspecie) => cambio === CAMBIO_DE_ESPECIE.requiereReabrir;
