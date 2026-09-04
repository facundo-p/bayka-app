/**
 * Cliente de la edge function admin-users (requiere service_role: invitación, ban, contraseña,
 * email); los mensajes de error en español vienen del backend, con fallback genérico.
 */
import { supabase } from '../lib/supabase';
import type { Rol } from '../repositories/profileRepository';
import type { CuerpoAdminUsers } from '../../../supabase/functions/admin-users/nucleo';

export const MENSAJE_ADMIN_USERS_GENERICO =
  'No se pudo completar la operación. Probá de nuevo.';

type RespuestaAdminUsers = { ok: boolean; error?: string };

/** El SDK adjunta la Response del server en error.context: de ahí sale el mensaje cuando el status es de error. */
async function mensajeDelError(error: unknown): Promise<string | null> {
  const contexto = (error as { context?: Response } | null)?.context;
  if (!contexto || typeof contexto.json !== 'function') return null;
  try {
    const cuerpo = (await contexto.json()) as RespuestaAdminUsers | null;
    return cuerpo?.error ?? null;
  } catch {
    return null;
  }
}

async function invocar(cuerpo: CuerpoAdminUsers): Promise<void> {
  const { data, error } = await supabase.functions.invoke<RespuestaAdminUsers>('admin-users', {
    body: cuerpo,
  });
  if (!error && data?.ok) return;
  const mensaje = data?.error ?? (await mensajeDelError(error));
  throw new Error(mensaje ?? MENSAJE_ADMIN_USERS_GENERICO);
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
