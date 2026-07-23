/**
 * Reglas de habilitación de las acciones por usuario. Espejan los guards del
 * backend (edge function + trigger): la UI deshabilita con el motivo visible
 * y el server rechaza igual si se fuerza la llamada.
 */
import { MENSAJES } from '../../../../supabase/functions/admin-users/nucleo';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ROL } from '../../repositories/profileRepository';

export type AccionUsuario =
  | 'editar'
  | 'cambiarPassword'
  | 'reenviarInvitacion'
  | 'desactivar'
  | 'reactivar';

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

/** Menú completo de una fila, con cada acción habilitada o su motivo. */
export function itemsDeMenu(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): ItemMenu[] {
  return [
    { accion: 'editar', etiqueta: 'Editar', motivo: null },
    {
      accion: 'cambiarPassword',
      etiqueta: 'Cambiar contraseña',
      motivo: motivoCambiarPassword(usuario, idActual),
    },
    {
      accion: 'reenviarInvitacion',
      etiqueta: 'Reenviar invitación',
      motivo: motivoReenviarInvitacion(usuario),
    },
    usuario.activo
      ? {
          accion: 'desactivar',
          etiqueta: 'Desactivar',
          motivo: motivoDesactivar(usuario, idActual, superadminsActivos),
          destructiva: true,
        }
      : { accion: 'reactivar', etiqueta: 'Reactivar', motivo: null },
  ];
}
