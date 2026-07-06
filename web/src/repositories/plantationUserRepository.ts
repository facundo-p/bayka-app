import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';
import type { RolEnPlantacion } from '../queries/usuarioQueries';

export const MENSAJE_USUARIO_YA_ASIGNADO = 'El usuario ya está asignado';

/**
 * Asigna el usuario a la plantación: le da acceso desde la app mobile.
 * Si ya estaba asignado (PK compuesta), lanza con un mensaje para el usuario.
 */
export async function asignarUsuario(
  plantationId: string,
  userId: string,
  rolEnPlantacion: RolEnPlantacion,
): Promise<void> {
  const { error } = await supabase.from('plantation_users').insert({
    plantation_id: plantationId,
    user_id: userId,
    rol_en_plantacion: rolEnPlantacion,
  });
  if (!error) return;
  if (error.code === PG_ERROR.UNIQUE_VIOLATION) throw new Error(MENSAJE_USUARIO_YA_ASIGNADO);
  throw new Error(error.message);
}

/**
 * Quita el acceso: el usuario deja de ver la plantación en la app.
 * Sus árboles registrados se conservan (no hay cascada sobre trees).
 */
export async function desasignarUsuario(plantationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('plantation_users')
    .delete()
    .eq('plantation_id', plantationId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
