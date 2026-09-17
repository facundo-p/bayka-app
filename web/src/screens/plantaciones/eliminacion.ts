/**
 * Eliminar una plantación de verdad (#478): qué muestra el modal según el
 * preview del server y qué dice cada variante. Puro: se testea sin renderizar.
 */
import { pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import {
  MOTIVO_NO_ELIMINABLE,
  type PreviewEliminacion,
} from '../../queries/eliminacionQueries';
import { ROL, type Perfil } from '../../repositories/profileRepository';
import type { ResultadoLimpiezaFotos } from '../../services/adminPlantacionesService';

export const VISTA_ELIMINACION = {
  /** Sin grupos ni árboles: confirmación simple. */
  sinDatos: 'sinDatos',
  /** Superadmin, con datos y archivada: hay que escribir el nombre. */
  confirmarNombre: 'confirmarNombre',
  /** Admin con datos: no puede borrarla, solo archivarla. */
  soloSuperadmin: 'soloSuperadmin',
  /** Superadmin con datos sin archivar. */
  archivarPrimero: 'archivarPrimero',
} as const;

export type VistaEliminacion = (typeof VISTA_ELIMINACION)[keyof typeof VISTA_ELIMINACION];

export const ETIQUETA_MENU_ELIMINAR = 'Eliminar plantación';

export function vistaEliminacion(preview: Pick<PreviewEliminacion, 'motivo' | 'tieneDatos'>) {
  if (preview.motivo === MOTIVO_NO_ELIMINABLE.requiereSuperadmin) {
    return VISTA_ELIMINACION.soloSuperadmin;
  }
  if (preview.motivo === MOTIVO_NO_ELIMINABLE.requiereArchivar) {
    return VISTA_ELIMINACION.archivarPrimero;
  }
  return preview.tieneDatos ? VISTA_ELIMINACION.confirmarNombre : VISTA_ELIMINACION.sinDatos;
}

/** Mismo criterio que el RPC: se ignoran los espacios de los extremos. */
export function nombreCoincide(escrito: string, lugar: string): boolean {
  return escrito.trim() === lugar.trim();
}

export function permiteBorrar(vista: VistaEliminacion): boolean {
  return vista === VISTA_ELIMINACION.sinDatos || vista === VISTA_ELIMINACION.confirmarNombre;
}

/** Las vistas que no borran ofrecen archivar si todavía no lo está. */
export function ofreceArchivar(vista: VistaEliminacion, archivada: boolean): boolean {
  return !permiteBorrar(vista) && !archivada;
}

/** "3 parcelas, 12 grupos y 1.234 árboles (456 con foto)". */
export function textoConteos(preview: PreviewEliminacion): string {
  const conFoto = `${pluralizar(preview.arbolesConFoto, SUSTANTIVO.arbol)} con foto`;
  return (
    `${pluralizar(preview.parcelas, SUSTANTIVO.parcela)}, ` +
    `${pluralizar(preview.grupos, SUSTANTIVO.grupo)} y ` +
    `${pluralizar(preview.arboles, SUSTANTIVO.arbol)} (${conFoto})`
  );
}

export function copySinDatos(lugar: string): string {
  return (
    `${lugar} no tiene grupos ni árboles cargados. Se borra para siempre, junto con sus ` +
    'parcelas, especies y técnicos asignados. No se puede deshacer.'
  );
}

export function copyConfirmarNombre(lugar: string, preview: PreviewEliminacion): string {
  return (
    `Se borran para siempre ${lugar} y todo lo que tiene: ${textoConteos(preview)}, ` +
    'con sus fotos. No se puede deshacer. ' +
    'Si algún celular tiene datos de esta plantación sin sincronizar, se pierden: ' +
    'ya no se van a poder subir.'
  );
}

export function copySoloSuperadmin(lugar: string, archivada: boolean): string {
  const base =
    `${lugar} tiene datos cargados (grupos o árboles), así que solo un superadmin puede ` +
    'eliminarla de verdad.';
  return archivada
    ? `${base} Ya está archivada: no aparece en los listados y queda en solo lectura.`
    : `${base} Lo que sí podés hacer es archivarla: deja de aparecer y queda en solo lectura.`;
}

export function copyArchivarPrimero(lugar: string): string {
  return (
    `${lugar} tiene datos cargados (grupos o árboles). Para eliminarla, primero archivala: ` +
    'así los celulares dejan de cargarle datos antes del borrado.'
  );
}

export const MENSAJE_ELIMINADA = 'La plantación se eliminó.';

export const MENSAJE_FOTOS_PENDIENTES =
  'La plantación se eliminó, pero algunas fotos no se pudieron borrar del almacenamiento. ' +
  'No quedan visibles para nadie y quedaron registradas para reintentar la limpieza.';

export function textoEliminada(fotosPendientes: boolean): string {
  return fotosPendientes ? MENSAJE_FOTOS_PENDIENTES : MENSAJE_ELIMINADA;
}

/** Espeja el guard de `limpiarFotos` en la edge function. */
export function puedeLimpiarFotos(perfil: Pick<Perfil, 'rol' | 'activo'> | null): boolean {
  return perfil !== null && perfil.activo && perfil.rol === ROL.SUPERADMIN;
}

export function textoLimpiezaFotos({ pendientes }: ResultadoLimpiezaFotos): string {
  return pendientes === 0
    ? 'No quedan fotos pendientes de borrar.'
    : 'Algunas fotos siguen sin poder borrarse. Probá de nuevo más tarde.';
}
