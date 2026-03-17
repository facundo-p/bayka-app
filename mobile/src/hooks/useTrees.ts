import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../database/client';
import { trees } from '../database/schema';
import { eq, desc } from 'drizzle-orm';

export function useTrees(subgrupoId: string) {
  const { data, error } = useLiveQuery(
    db.select().from(trees)
      .where(eq(trees.subgrupoId, subgrupoId))
      .orderBy(desc(trees.posicion))
  );
  const allTrees = data ?? [];
  const lastThree = allTrees.slice(0, 3);
  const totalCount = allTrees.length;
  const unresolvedNN = allTrees.filter((t) => t.especieId === null).length;
  return { allTrees, lastThree, totalCount, unresolvedNN, error };
}
