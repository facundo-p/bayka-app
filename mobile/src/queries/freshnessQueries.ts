import { db } from '../database/client';
import { groups } from '../database/schema';
import { sql } from 'drizzle-orm';
import { supabase } from '../supabase/client';

// Module-level cooldown (30 seconds between checks)
let lastFreshnessCheck = 0;
const FRESHNESS_COOLDOWN_MS = 30_000;

/** Timestamp created_at más nuevo de los groups locales; null si no hay ninguno. */
export async function getLocalMaxGroupCreatedAt(): Promise<string | null> {
  const result = await db
    .select({ maxCreatedAt: sql<string>`MAX(${groups.createdAt})` })
    .from(groups);
  return result[0]?.maxCreatedAt ?? null;
}

/** True si el server tiene groups más nuevos que lo local, para las plantaciones dadas; false dentro del cooldown o ante cualquier error (silent skip). */
export async function checkFreshness(plantacionIds: string[]): Promise<boolean> {
  if (plantacionIds.length === 0) return false;

  const now = Date.now();
  if (now - lastFreshnessCheck < FRESHNESS_COOLDOWN_MS) return false;
  lastFreshnessCheck = now;

  try {
    const localMax = await getLocalMaxGroupCreatedAt();

    const { data } = await supabase
      // Consulta la vista compat `subgroups`; migrar a `groups` (#301).
      .from('subgroups')
      .select('created_at')
      .in('plantation_id', plantacionIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data?.created_at) return false;
    if (!localMax) return true; // server has data, local has none

    return data.created_at > localMax;
  } catch {
    return false;
  }
}

/** Reset cooldown — exposed for testing only */
export function _resetCooldown() {
  lastFreshnessCheck = 0;
}
