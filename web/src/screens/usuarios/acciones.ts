/**
 * Reglas de habilitación de las acciones por usuario. Espejan los guards del
 * backend (edge function + trigger): la UI deshabilita con el motivo visible
 * y el server rechaza igual si se fuerza la llamada.
 */
import { MENSAJES } from '../../../../supabase/functions/admin-users/nucleo';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ROL } from '../../repositories/profileRepository';

/** Acciones rápidas sobre una persona: las del menú "⋯" y las del panel lateral. */
export const ACCION_USUARIO = {
  cambiarPassword: 'cambiarPassword',
  reenviarInvitacion: 'reenviarInvitacion',
  desactivar: 'desactivar',
  reactivar: 'reactivar',
} as const;

export type AccionUsuario = (typeof ACCION_USUARIO)[keyof typeof ACCION_USUARIO];

/** Una acción elegida sobre una persona: abre su modal. */
export type AccionActiva = { usuario: UsuarioConAsignaciones; accion: AccionUsuario };

export type ItemMenu = {
  accion: AccionUsuario;
  etiqueta: string;
  /** null = habilitada; texto = por qué está deshabilitada (visible en title). */
  motivo: string | null;
  destructiva?: boolean;
};

export const MOTIVO_ROL_PROPIO =
  'No podés cambiar tu propio rol: un superadmin no puede degradarse a sí mismo';
export const MOTIVO_ULTIMO_SUPERADMIN = 'Único superadmin: promové otro antes de degradarlo';
export const MOTIVO_SIN_EMAIL = 'El usuario no tiene email registrado';

export function contarSuperadminsActivos(usuarios: UsuarioConAsignaciones[]): number {
  return usuarios.filter((usuario) => usuario.rol === ROL.SUPERADMIN && usuario.activo).length;
}

/** Guard del campo Rol del modal Editar (espeja el trigger del server). */
export function motivoCambiarRol(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): string | null {
  if (usuario.id === idActual) return MOTIVO_ROL_PROPIO;
  if (usuario.rol === ROL.SUPERADMIN && usuario.activo && superadminsActivos === 1) {
    return MOTIVO_ULTIMO_SUPERADMIN;
  }
  return null;
}

export function motivoCambiarPassword(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
): string | null {
  if (usuario.rol === ROL.SUPERADMIN && usuario.id !== idActual) {
    return MENSAJES.passwordDeOtroSuperadmin;
  }
  return null;
}

/** Motivo para deshabilitar Desactivar (Reactivar no tiene guards). */
export function motivoDesactivar(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): string | null {
  if (usuario.id === idActual) return MENSAJES.autoDesactivacion;
  if (usuario.rol === ROL.SUPERADMIN && superadminsActivos === 1) {
    return MENSAJES.ultimoSuperadmin;
  }
  return null;
}

export function motivoReenviarInvitacion(usuario: UsuarioConAsignaciones): string | null {
  return usuario.email ? null : MOTIVO_SIN_EMAIL;
}

/** Acciones rápidas de una fila, con cada una habilitada o su motivo. Editar no
 *  está: se edita clickeando la fila, que abre el panel lateral. */
export function itemsDeMenu(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): ItemMenu[] {
  return [
    {
      accion: ACCION_USUARIO.cambiarPassword,
      etiqueta: 'Cambiar contraseña',
      motivo: motivoCambiarPassword(usuario, idActual),
    },
    {
      accion: ACCION_USUARIO.reenviarInvitacion,
      etiqueta: 'Reenviar invitación',
      motivo: motivoReenviarInvitacion(usuario),
    },
    usuario.activo
      ? {
          accion: ACCION_USUARIO.desactivar,
          etiqueta: 'Desactivar',
          motivo: motivoDesactivar(usuario, idActual, superadminsActivos),
          destructiva: true,
        }
      : { accion: ACCION_USUARIO.reactivar, etiqueta: 'Reactivar', motivo: null },
  ];
}
