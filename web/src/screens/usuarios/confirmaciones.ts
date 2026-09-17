/**
 * Qué dice y qué ejecuta el modal de confirmación de cada acción rápida. Los
 * textos avisan qué se pierde y qué se conserva antes de confirmar.
 */
import {
  MODO_ELIMINACION,
  type PreviewEliminacion,
} from '../../../../supabase/functions/admin-users/nucleo';
import { pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import {
  desactivarUsuario,
  reactivarUsuario,
  reenviarInvitacion,
} from '../../services/adminUsersService';
import { ACCION_USUARIO, type AccionUsuario } from './acciones';

/** Cambiar la contraseña tiene su propio formulario y eliminar arma el texto con el
 *  preview del server: ninguna de las dos tiene una confirmación fija. */
export type AccionConfirmable = Exclude<
  AccionUsuario,
  typeof ACCION_USUARIO.cambiarPassword | typeof ACCION_USUARIO.eliminar
>;

export const TEXTO_REVISANDO_DATOS = 'Revisando qué datos registró…';

export const AVISO_ELIMINAR =
  'Lo que tenga sin sincronizar en su celular se pierde. Esta acción no se puede deshacer.';

/** "12 árboles, 2 grupos y 1 plantación", omitiendo lo que está en cero. */
function resumenRegistros({ arboles, grupos, plantaciones }: PreviewEliminacion): string {
  const partes = [
    [arboles, SUSTANTIVO.arbol],
    [grupos, SUSTANTIVO.grupo],
    [plantaciones, SUSTANTIVO.plantacion],
  ] as const;
  const textos = partes
    .filter(([cantidad]) => cantidad > 0)
    .map(([cantidad, sustantivo]) => pluralizar(cantidad, sustantivo));
  if (textos.length < 2) return textos.join('');
  return `${textos.slice(0, -1).join(', ')} y ${textos[textos.length - 1]}`;
}

/** Qué pasa al eliminar, según tenga o no datos de campo a su nombre. */
export function copyEliminar(nombre: string, preview: PreviewEliminacion): string {
  if (preview.modo === MODO_ELIMINACION.real) {
    return `${nombre} no registró datos: se borra por completo.`;
  }
  return (
    `${nombre} registró ${resumenRegistros(preview)}: se bloquea para siempre, ` +
    'su nombre queda en el historial y su email se libera para invitarlo de nuevo.'
  );
}

export interface Confirmacion {
  titulo: (nombre: string) => string;
  descripcion: (nombre: string, usuario: UsuarioConAsignaciones) => string;
  etiqueta: string;
  destructiva?: boolean;
  /** Con texto de éxito, el modal muestra el resultado en vez de cerrarse. */
  textoExito?: string;
  servicio: (usuario: UsuarioConAsignaciones) => Promise<void>;
}

function copyDesactivar(nombre: string): string {
  return (
    `${nombre} va a perder el acceso a la app y a la web en cuanto su sesión se renueve. ` +
    'Si está trabajando sin conexión, sigue operando hasta reconectar. ' +
    'Sus datos de campo (árboles y grupos registrados) se conservan. Se puede reactivar.'
  );
}

export const CONFIRMACION_POR_ACCION: Record<AccionConfirmable, Confirmacion> = {
  [ACCION_USUARIO.reenviarInvitacion]: {
    titulo: (nombre) => `Reenviar invitación a ${nombre}`,
    descripcion: (_nombre, usuario) =>
      `Le va a llegar un email a ${usuario.email ?? ''} para definir su contraseña.`,
    etiqueta: 'Reenviar',
    textoExito: 'Invitación enviada.',
    servicio: (usuario) => reenviarInvitacion(usuario.email ?? ''),
  },
  [ACCION_USUARIO.desactivar]: {
    titulo: (nombre) => `Desactivar a ${nombre}`,
    descripcion: copyDesactivar,
    etiqueta: 'Desactivar',
    destructiva: true,
    servicio: (usuario) => desactivarUsuario(usuario.id),
  },
  [ACCION_USUARIO.reactivar]: {
    titulo: (nombre) => `Reactivar a ${nombre}`,
    descripcion: (nombre) => `${nombre} va a recuperar el acceso que tenía según su rol.`,
    etiqueta: 'Reactivar',
    servicio: (usuario) => reactivarUsuario(usuario.id),
  },
};
