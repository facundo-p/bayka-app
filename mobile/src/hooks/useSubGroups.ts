import { useLiveData } from '../database/liveQuery';
import { db } from '../database/client';
import { subgroups } from '../database/schema';
import { eq, desc } from 'drizzle-orm';

export function useSubGroupsForPlantation(plantacionId: string) {
  const { data } = useLiveData(
    () => db.select().from(subgroups)
      .where(eq(subgroups.plantacionId, plantacionId))
      .orderBy(desc(subgroups.createdAt)),
    [plantacionId]
  );
  return { subgroups: data ?? [] };
}
