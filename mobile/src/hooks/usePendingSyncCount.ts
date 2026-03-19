import { useLiveData } from '../database/liveQuery';
import { db } from '../database/client';
import { subgroups } from '../database/schema';
import { eq, count, and } from 'drizzle-orm';

/**
 * Returns the live count of SubGroups with estado = 'finalizada'.
 * - Without plantacionId: total pending count across ALL plantations (used by tab badge).
 * - With plantacionId: pending count for a specific plantation (used by card badge and sync CTA).
 */
export function usePendingSyncCount(plantacionId?: string) {
  const { data } = useLiveData(
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
  return { pendingCount: data?.[0]?.cnt ?? 0 };
}
