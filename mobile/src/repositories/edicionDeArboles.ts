import { db } from '../database/client';
import { groups } from '../database/schema';
import { eq } from 'drizzle-orm';
import { readCachedRole, readCachedUserId } from '../supabase/auth';
import { esRolAdmin } from '../types/domain';
import { getPlantationEstadoDeEdicion } from '../queries/estadoDeEdicionQueries';
import { puedeEditarArbolesDelGrupo } from '../utils/permisosDeEdicion';

export const SIN_PERMISO_SOBRE_ARBOLES = 'No tenés permiso para editar los árboles de este grupo.';

/**
 * `puedeEditarArbolesDelGrupo` con la sesión cacheada: la pantalla ya no ofrece la
 * acción, esto frena cualquier otro camino (#768). Un grupo o una plantación que no
 * están locales no se editan.
 */
export async function puedeEditarArbolesDe(grupoId: string): Promise<boolean> {
  const [grupo] = await db
    .select({ usuarioCreador: groups.usuarioCreador, plantacionId: groups.plantacionId })
    .from(groups)
    .where(eq(groups.id, grupoId));
  const plantacion = grupo ? await getPlantationEstadoDeEdicion(grupo.plantacionId) : null;
  if (!grupo || !plantacion) return false;
  const [rol, userId] = await Promise.all([readCachedRole(), readCachedUserId()]);
  return puedeEditarArbolesDelGrupo({
    plantacion,
    isCreator: userId != null && grupo.usuarioCreador === userId,
    esAdmin: esRolAdmin(rol),
  });
}
