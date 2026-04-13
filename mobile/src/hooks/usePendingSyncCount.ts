import { useLiveData } from '../database/liveQuery';
import { db } from '../database/client';
import { subgroups, trees } from '../database/schema';
import { eq, count, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { useCurrentUserId } from './useCurrentUserId';

/**
 * Returns live counts for SubGroups with pendingSync=true.
 * Filtered by current user — each user only sees their own pending subgroups.
 * - pendingCount: total with pendingSync=true (shown on badge/card)
 * - syncableCount: pendingSync=true subgroups with no unresolved N/N (shown on sync CTA)
 * - blockedByNN: finalizada but blocked by unresolved N/N
 */
export function usePendingSyncCount(plantacionId?: string) {
  const userId = useCurrentUserId();

  const { data: pendingData } = useLiveData(
    () => {
      const conditions = [eq(subgroups.pendingSync, true)];
      if (plantacionId) {
        conditions.push(eq(subgroups.plantacionId, plantacionId));
      }
      if (userId) {
        conditions.push(eq(subgroups.usuarioCreador, userId));
      }
      return db
        .select({ cnt: count() })
        .from(subgroups)
        .where(and(...conditions));
    },
    [plantacionId, userId]
  );

  // Count finalizada SubGroups that have unresolved N/N trees
  const { data: nnBlockedData } = useLiveData(
    () => {
      if (!plantacionId) {
        // For global badge, just return 0 — we don't need syncable distinction there
        return Promise.resolve([{ cnt: 0 }]);
      }
      const conditions = [
        eq(subgroups.plantacionId, plantacionId),
        eq(subgroups.estado, 'finalizada'),
        sql`EXISTS (SELECT 1 FROM trees WHERE trees.subgrupo_id = ${subgroups.id} AND trees.especie_id IS NULL)`,
      ];
      if (userId) {
        conditions.push(eq(subgroups.usuarioCreador, userId));
      }
      return db
        .select({ cnt: count() })
        .from(subgroups)
        .where(and(...conditions));
    },
    [plantacionId, userId]
  );

  // Count trees with local photos not yet uploaded (in synced subgroups, pendingSync=false)
  const { data: pendingPhotosData } = useLiveData(
    () => {
      if (!plantacionId) {
        return Promise.resolve([{ cnt: 0 }]);
      }
      return db
        .select({ cnt: count() })
        .from(trees)
        .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
        .where(
          and(
            eq(subgroups.plantacionId, plantacionId),
            eq(subgroups.pendingSync, false),
            isNotNull(trees.fotoUrl),
            eq(trees.fotoSynced, false),
            sql`${trees.fotoUrl} LIKE 'file://%'`
          )
        );
    },
    [plantacionId]
  );

  const pendingCount = pendingData?.[0]?.cnt ?? 0;
  const blockedByNN = nnBlockedData?.[0]?.cnt ?? 0;
  const syncableCount = pendingCount - blockedByNN;
  const pendingPhotosCount = pendingPhotosData?.[0]?.cnt ?? 0;

  return { pendingCount, syncableCount, blockedByNN, pendingPhotosCount };
}
