/**
 * Qué dice y qué ejecuta el modal de confirmación de cada acción rápida. Los
 * textos avisan qué se pierde y qué se conserva antes de confirmar.
 */
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import {
  desactivarUsuario,
  reactivarUsuario,
  reenviarInvitacion,
} from '../../services/adminUsersService';
import { ACCION_USUARIO, type AccionUsuario } from './acciones';

/** Cambiar la contraseña no se confirma: tiene su propio formulario. */
export type AccionConfirmable = Exclude<AccionUsuario, typeof ACCION_USUARIO.cambiarPassword>;

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
