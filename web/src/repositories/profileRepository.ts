import { supabase } from '../lib/supabase';

export type Rol = 'admin' | 'tecnico' | 'superadmin';

export type Perfil = {
  id: string;
  nombre: string;
  rol: Rol;
  organizacionId: string;
};

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
