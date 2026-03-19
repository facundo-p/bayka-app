import { useLiveData } from '../database/liveQuery';
import { db } from '../database/client';
import { subgroups, trees } from '../database/schema';
import { eq, count, and, isNull, sql } from 'drizzle-orm';

/**
 * Returns live counts for SubGroups with estado = 'finalizada'.
 * - pendingCount: total finalizada (shown on badge/card)
 * - syncableCount: finalizada with no unresolved N/N (shown on sync CTA)
 * - blockedByNN: finalizada but blocked by unresolved N/N
 */
export function usePendingSyncCount(plantacionId?: string) {
  const { data: pendingData } = useLiveData(
    () => {
      const conditions = [eq(subgroups.estado, 'finalizada')];
      if (plantacionId) {
        conditions.push(eq(subgroups.plantacionId, plantacionId));
      }
      return db
        .select({ cnt: count() })
        .from(subgroups)
        .where(and(...conditions));
    },
    [plantacionId]
  );

  // Count finalizada SubGroups that have unresolved N/N trees
  const { data: nnBlockedData } = useLiveData(
    () => {
      if (!plantacionId) {
        // For global badge, just return 0 — we don't need syncable distinction there
        return Promise.resolve([{ cnt: 0 }]);
      }
      return db
        .select({ cnt: count() })
        .from(subgroups)
        .where(and(
          eq(subgroups.plantacionId, plantacionId),
          eq(subgroups.estado, 'finalizada'),
          sql`EXISTS (SELECT 1 FROM trees WHERE trees.subgrupo_id = ${subgroups.id} AND trees.especie_id IS NULL)`
        ));
    },
    [plantacionId]
  );

  const pendingCount = pendingData?.[0]?.cnt ?? 0;
  const blockedByNN = nnBlockedData?.[0]?.cnt ?? 0;
  const syncableCount = pendingCount - blockedByNN;

  return { pendingCount, syncableCount, blockedByNN };
}
