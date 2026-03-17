import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../database/client';
import { subgroups } from '../database/schema';
import { eq, desc } from 'drizzle-orm';

export function useSubGroupsForPlantation(plantacionId: string) {
  const { data, error } = useLiveQuery(
    db.select().from(subgroups)
      .where(eq(subgroups.plantacionId, plantacionId))
      .orderBy(desc(subgroups.createdAt))
  );
  return { subgroups: data ?? [], error };
}
