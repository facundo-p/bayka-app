import { ROL } from '../constants/roles';

export type Role = 'admin' | 'tecnico' | 'superadmin';

/** Roles que operan la app con capacidades de administración: el superadmin
 *  (gestión de usuarios en la web) trabaja en campo igual que un admin.
 *  Todo chequeo de "es admin" debe usar este helper, nunca igualdad estricta. */
export function esRolAdmin(rol: string | null | undefined): boolean {
  return rol === ROL.admin || rol === ROL.superadmin;
}

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: Role;
  organizacionId: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
}
