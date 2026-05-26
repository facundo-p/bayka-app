import { useLiveData } from '../database/liveQuery';
import { db } from '../database/client';
import { groups, trees } from '../database/schema';
import { eq, count, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { useCurrentUserId } from './useCurrentUserId';
import { sqlIsLocalUri } from '../utils/photoUri';

/**
 * Returns live counts for Groups with pendingSync=true.
 * Filtered by current user — each user only sees their own pending groups.
 * - pendingCount: total with pendingSync=true (shown on badge/card)
 * - syncableCount: pendingSync=true groups with no unresolved N/N (shown on sync CTA)
 * - blockedByNN: finalizada but blocked by unresolved N/N
 */
export function usePendingSyncCount(plantacionId?: string) {
  const userId = useCurrentUserId();

  const { data: pendingData } = useLiveData(
    () => {
      const conditions = [eq(groups.pendingSync, true)];
      if (plantacionId) {
        conditions.push(eq(groups.plantacionId, plantacionId));
      }
      if (userId) {
        conditions.push(eq(groups.usuarioCreador, userId));
      }
      return db
        .select({ cnt: count() })
        .from(groups)
        .where(and(...conditions));
    },
    [plantacionId, userId]
  );

  // Count finalizada Groups that have unresolved N/N trees
  const { data: nnBlockedData } = useLiveData(
    () => {
      if (!plantacionId) {
        // For global badge, just return 0 — we don't need syncable distinction there
        return Promise.resolve([{ cnt: 0 }]);
      }
      const conditions = [
        eq(groups.plantacionId, plantacionId),
        eq(groups.estado, 'finalizada'),
        sql`EXISTS (SELECT 1 FROM trees WHERE trees.group_id = ${groups.id} AND trees.especie_id IS NULL)`,
      ];
      if (userId) {
        conditions.push(eq(groups.usuarioCreador, userId));
      }
      return db
        .select({ cnt: count() })
        .from(groups)
        .where(and(...conditions));
    },
    [plantacionId, userId]
  );

  // Count trees with local photos not yet uploaded (in synced groups, pendingSync=false)
  const { data: pendingPhotosData } = useLiveData(
    () => {
      if (!plantacionId) {
        return Promise.resolve([{ cnt: 0 }]);
      }
      return db
        .select({ cnt: count() })
        .from(trees)
        .innerJoin(groups, eq(trees.groupId, groups.id))
        .where(
          and(
            eq(groups.plantacionId, plantacionId),
            eq(groups.pendingSync, false),
            isNotNull(trees.fotoUrl),
            eq(trees.fotoSynced, false),
            sqlIsLocalUri(trees.fotoUrl)
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
