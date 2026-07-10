/** Constantes de presentación compartidas por la pantalla y los modales de usuarios. */
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { ROL, type Rol } from '../../repositories/profileRepository';

export const ADVERTENCIA_SUPERADMIN =
  'Va a tener acceso total, incluida la gestión de usuarios.';

export const ROLES: Array<{ valor: Rol; etiqueta: string }> = [
  { valor: ROL.TECNICO, etiqueta: 'Técnico' },
  { valor: ROL.ADMIN, etiqueta: 'Admin' },
  { valor: ROL.SUPERADMIN, etiqueta: 'Superadmin' },
];

export const ETIQUETA_ROL: Record<Rol, string> = {
  [ROL.SUPERADMIN]: 'Superadmin',
  [ROL.ADMIN]: 'Admin',
  [ROL.TECNICO]: 'Técnico',
};

/** Nombre visible: un perfil sin nombre se identifica por el id corto. */
export function nombreVisible(usuario: UsuarioConAsignaciones): string {
  return usuario.nombre || usuario.id.slice(0, 8);
}
