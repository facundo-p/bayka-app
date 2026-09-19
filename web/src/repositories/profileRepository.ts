import { mensajeDeError } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';

/** Valores de rol global (columna `profiles.rol`). Fuente única de verdad:
 *  todo comparación/asignación de rol usa estas constantes, no literales. */
export const ROL = {
  ADMIN: 'admin',
  TECNICO: 'tecnico',
  SUPERADMIN: 'superadmin',
} as const;

export type Rol = (typeof ROL)[keyof typeof ROL];

/** Eliminado es irreversible: no admite acciones y los listados lo ocultan por defecto. */
export function esEliminado(perfil: { eliminadoEn: string | null }): boolean {
  return perfil.eliminadoEn !== null;
}

export type Perfil = {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  organizacionId: string;
};

/** Mensajes del trigger del server que protege profiles.rol: ya vienen en
 *  español y se muestran tal cual; cualquier otro error se vuelve genérico. */
const MENSAJES_TRIGGER_ROL = [
  'Solo un superadmin puede cambiar roles',
  'Un superadmin no puede degradarse a sí mismo',
] as const;

const ACCION_CAMBIAR_ROL = 'cambiar el rol';

function mensajeDeCambioRol(error: { message: string; code?: string }): string {
  const legible = MENSAJES_TRIGGER_ROL.find((mensaje) => error.message.includes(mensaje));
  return legible ?? mensajeDeError(error, ACCION_CAMBIAR_ROL);
}

/**
 * Cambia el rol global del usuario. Las reglas (solo superadmin, sin
 * degradación propia) las garantiza el trigger del server; acá solo se
 * traduce su error a un mensaje mostrable.
 */
export async function cambiarRol(userId: string, nuevoRol: Rol): Promise<void> {
  const { error } = await supabase.from('profiles').update({ rol: nuevoRol }).eq('id', userId);
  if (error) throw new Error(mensajeDeCambioRol(error));
}

const ACCION_GUARDAR_NOMBRE = 'guardar el nombre';

/** Cambia el nombre visible (la policy de superadmin de la 024 lo permite). */
export async function actualizarNombre(userId: string, nombre: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ nombre }).eq('id', userId);
  if (error) throw new Error(mensajeDeError(error, ACCION_GUARDAR_NOMBRE));
}

/**
 * Carga el perfil del usuario desde `profiles`.
 * Devuelve null si no existe la fila; lanza ante error de red/DB.
 */
export async function getPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol, activo, organizacion_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    nombre: data.nombre,
    rol: data.rol,
    activo: data.activo,
    organizacionId: data.organizacion_id,
  };
}
