/**
 * Cliente de la edge function admin-users (requiere service_role: invitación, ban, contraseña,
 * email); los mensajes de error en español vienen del backend, con fallback genérico.
 */
import type { Rol } from '../repositories/profileRepository';
import { MENSAJES, type CuerpoAdminUsers } from '../../../supabase/functions/admin-users/nucleo';
import { invocarEdgeFunction } from './edgeFunction';

/** Solo para cuando no se pudo leer ningún mensaje del backend (red, respuesta no-JSON). */
export const MENSAJE_ADMIN_USERS_GENERICO = MENSAJES.errorGenerico;

async function invocar(cuerpo: CuerpoAdminUsers): Promise<void> {
  await invocarEdgeFunction('admin-users', cuerpo, MENSAJE_ADMIN_USERS_GENERICO);
}

export async function crearUsuario(datos: {
  nombre: string;
  email: string;
  rol: Rol;
}): Promise<void> {
  await invocar({ accion: 'crear', ...datos });
}

export async function reenviarInvitacion(email: string): Promise<void> {
  await invocar({ accion: 'reenviarInvitacion', email });
}

export async function desactivarUsuario(userId: string): Promise<void> {
  await invocar({ accion: 'desactivar', userId });
}

export async function reactivarUsuario(userId: string): Promise<void> {
  await invocar({ accion: 'reactivar', userId });
}

export async function cambiarPassword(userId: string, password: string): Promise<void> {
  await invocar({ accion: 'cambiarPassword', userId, password });
}

export async function cambiarEmail(userId: string, email: string): Promise<void> {
  await invocar({ accion: 'cambiarEmail', userId, email });
}
