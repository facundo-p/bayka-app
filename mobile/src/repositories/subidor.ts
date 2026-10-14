import { eq, type SQL } from 'drizzle-orm';
import { groups } from '../database/schema';
import { readCachedRole, readCachedUserId } from '../supabase/auth';
import { esRolAdmin } from '../types/domain';

/** Quién sube: un técnico, solo sus grupos; admin y superadmin, también los ajenos que editaron (#768). */
export interface Subidor {
  userId: string | null;
  esAdmin: boolean;
}

/** La sesión cacheada: el guard de sesión del sync exige que sea la misma cuenta que la del SDK. */
export async function subidorActual(): Promise<Subidor> {
  const [userId, rol] = await Promise.all([readCachedUserId(), readCachedRole()]);
  return { userId, esAdmin: esRolAdmin(rol) };
}

/** Condición sobre `groups` de lo que sube `subidor`, o undefined si sube todo. Sin userId, ningún grupo. */
export function gruposQueSube(subidor: Subidor): SQL | undefined {
  if (subidor.esAdmin) return undefined;
  return eq(groups.usuarioCreador, subidor.userId ?? '');
}
