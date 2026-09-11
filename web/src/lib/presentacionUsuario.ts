/** Cómo se muestra una persona en la UI: la etiqueta de su rol y su nombre. */
import { ROL, type Rol } from '../repositories/profileRepository';

/** Caracteres del id que identifican a un perfil sin nombre. */
export const LARGO_ID_CORTO = 8;

const ETIQUETA_ROL = {
  [ROL.SUPERADMIN]: 'Superadmin',
  [ROL.ADMIN]: 'Administrador',
  [ROL.TECNICO]: 'Técnico',
} as const satisfies Record<Rol, string>;

export function etiquetaRol(rol: Rol): string {
  return ETIQUETA_ROL[rol];
}

/** Un perfil sin nombre (o de solo espacios) se identifica por el id corto. */
export function nombreVisible(nombre: string | null, id: string): string {
  return nombre?.trim() || id.slice(0, LARGO_ID_CORTO);
}
