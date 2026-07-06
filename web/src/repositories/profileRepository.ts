import { supabase } from '../lib/supabase';

export type Rol = 'admin' | 'tecnico' | 'superadmin';

export type Perfil = {
  id: string;
  nombre: string;
  rol: Rol;
  organizacionId: string;
};

/** Mensajes del trigger del server que protege profiles.rol: ya vienen en
 *  español y se muestran tal cual; cualquier otro error se vuelve genérico. */
const MENSAJES_TRIGGER_ROL = [
  'Solo un superadmin puede cambiar roles',
  'Un superadmin no puede degradarse a sí mismo',
] as const;

export const MENSAJE_CAMBIO_ROL_GENERICO =
  'No se pudo cambiar el rol. Revisá tu conexión y probá de nuevo.';

function mensajeDeCambioRol(mensajeDelServer: string): string {
  const legible = MENSAJES_TRIGGER_ROL.find((mensaje) => mensajeDelServer.includes(mensaje));
  return legible ?? MENSAJE_CAMBIO_ROL_GENERICO;
}

/**
 * Cambia el rol global del usuario. Las reglas (solo superadmin, sin
 * degradación propia) las garantiza el trigger del server; acá solo se
 * traduce su error a un mensaje mostrable.
 */
export async function cambiarRol(userId: string, nuevoRol: Rol): Promise<void> {
  const { error } = await supabase.from('profiles').update({ rol: nuevoRol }).eq('id', userId);
  if (error) throw new Error(mensajeDeCambioRol(error.message));
}

/**
 * Carga el perfil del usuario desde `profiles`.
 * Devuelve null si no existe la fila; lanza ante error de red/DB.
 */
export async function getPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol, organizacion_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    nombre: data.nombre,
    rol: data.rol,
    organizacionId: data.organizacion_id,
  };
}
