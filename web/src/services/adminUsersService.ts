/**
 * Cliente de la edge function admin-users (requiere service_role: invitación, ban, contraseña,
 * email); los mensajes de error en español vienen del backend, con fallback genérico.
 */
import type { Rol } from '../repositories/profileRepository';
import {
  MENSAJES,
  type CuerpoAdminUsers,
  type PreviewEliminacion,
  type Respuesta,
} from '../../../supabase/functions/admin-users/nucleo';
import { invocarEdgeFunction } from './edgeFunction';

/** Solo para cuando no se pudo leer ningún mensaje del backend (red, respuesta no-JSON). */
export const MENSAJE_ADMIN_USERS_GENERICO = MENSAJES.errorGenerico;

type RespuestaAdminUsers = Respuesta['body'];

async function invocar(cuerpo: CuerpoAdminUsers): Promise<RespuestaAdminUsers> {
  return invocarEdgeFunction<RespuestaAdminUsers>(
    'admin-users',
    cuerpo,
    MENSAJE_ADMIN_USERS_GENERICO,
  );
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

/** Cuántos registros tiene a su nombre y, por eso, si se borra por completo o se bloquea. */
export async function previsualizarEliminacion(userId: string): Promise<PreviewEliminacion> {
  const { preview } = await invocar({ accion: 'previsualizarEliminacion', userId });
  if (!preview) throw new Error(MENSAJE_ADMIN_USERS_GENERICO);
  return preview;
}

export async function eliminarUsuario(userId: string): Promise<void> {
  await invocar({ accion: 'eliminar', userId });
}
