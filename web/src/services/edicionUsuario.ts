/**
 * Guarda la edición de una persona. Nombre y rol van directo a profiles; el
 * email, a Auth vía la edge function, y el trigger lo sincroniza en profiles.
 */
import { actualizarNombre, cambiarRol, type Rol } from '../repositories/profileRepository';
import { cambiarEmail } from './adminUsersService';

/** Solo lo que cambió: un campo ausente no se envía. */
export interface CambiosUsuario {
  nombre?: string;
  email?: string;
  rol?: Rol;
}

/** Cada campo toca un backend independiente: van en paralelo. */
export async function guardarCambiosUsuario(
  userId: string,
  cambios: CambiosUsuario,
): Promise<void> {
  await Promise.all([
    cambios.nombre === undefined ? null : actualizarNombre(userId, cambios.nombre),
    cambios.email === undefined ? null : cambiarEmail(userId, cambios.email),
    cambios.rol === undefined ? null : cambiarRol(userId, cambios.rol),
  ]);
}
