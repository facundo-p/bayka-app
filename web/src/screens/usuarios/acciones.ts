/**
 * Reglas de habilitación de las acciones por usuario. Espejan los guards del
 * backend (edge function + trigger): la UI deshabilita con el motivo visible
 * y el server rechaza igual si se fuerza la llamada.
 */
import { MENSAJES } from '../../../../supabase/functions/admin-users/nucleo';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { esEliminado, ROL } from '../../repositories/profileRepository';

/** Acciones rápidas sobre una persona: las del menú "⋯" y las del panel lateral. */
export const ACCION_USUARIO = {
  cambiarPassword: 'cambiarPassword',
  reenviarInvitacion: 'reenviarInvitacion',
  desactivar: 'desactivar',
  reactivar: 'reactivar',
  eliminar: 'eliminar',
} as const;

export type AccionUsuario = (typeof ACCION_USUARIO)[keyof typeof ACCION_USUARIO];

/** Lo que miran los guards además de la persona: quién opera y cuántos
 *  superadmins activos hay, contados sobre todas las personas sin filtrar. */
export interface ContextoAcciones {
  idActual: string | undefined;
  superadminsActivos: number;
}

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

type MotivosBaja = { aSiMismo: string; ultimoSuperadmin: string };

/** Desactivar y eliminar comparten guards: ni a uno mismo ni al único superadmin. */
function motivoDeBaja(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
  motivos: MotivosBaja,
): string | null {
  if (usuario.id === idActual) return motivos.aSiMismo;
  if (usuario.rol === ROL.SUPERADMIN && superadminsActivos === 1) {
    return motivos.ultimoSuperadmin;
  }
  return null;
}

/** Motivo para deshabilitar Desactivar (Reactivar no tiene guards). */
export function motivoDesactivar(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): string | null {
  return motivoDeBaja(usuario, idActual, superadminsActivos, {
    aSiMismo: MENSAJES.autoDesactivacion,
    ultimoSuperadmin: MENSAJES.ultimoSuperadmin,
  });
}

export function motivoEliminar(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): string | null {
  return motivoDeBaja(usuario, idActual, superadminsActivos, {
    aSiMismo: MENSAJES.autoEliminacion,
    ultimoSuperadmin: MENSAJES.ultimoSuperadminEliminar,
  });
}

export function motivoReenviarInvitacion(usuario: UsuarioConAsignaciones): string | null {
  return usuario.email ? null : MOTIVO_SIN_EMAIL;
}

/** Desactivar a una persona activa, con sus guards, o reactivar a una inactiva. */
function itemDeEstado(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): ItemMenu {
  if (!usuario.activo) {
    return { accion: ACCION_USUARIO.reactivar, etiqueta: 'Reactivar', motivo: null };
  }
  return {
    accion: ACCION_USUARIO.desactivar,
    etiqueta: 'Desactivar',
    motivo: motivoDesactivar(usuario, idActual, superadminsActivos),
    destructiva: true,
  };
}

/** Acciones rápidas de una fila, con cada una habilitada o su motivo. Editar no
 *  está: se edita clickeando la fila, que abre el panel lateral. Un eliminado no
 *  admite ninguna. */
export function itemsDeMenu(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  superadminsActivos: number,
): ItemMenu[] {
  if (esEliminado(usuario)) return [];
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
    itemDeEstado(usuario, idActual, superadminsActivos),
    {
      accion: ACCION_USUARIO.eliminar,
      etiqueta: 'Eliminar',
      motivo: motivoEliminar(usuario, idActual, superadminsActivos),
      destructiva: true,
    },
  ];
}
