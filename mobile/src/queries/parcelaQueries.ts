/**
 * Query functions for parcela views and stats.
 * Reusable aggregations (CLAUDE.md §9 — no SQL in screens/hooks).
 *
 * ALL read paths filter `deletedAt IS NULL` by default (D-16-19). Sync
 * internals call ParcelaRepository.findById({ includeDeleted: true }) when
 * they need to surface tombstoned rows.
 */
import { db } from '../database/client';
import { parcelas, groups, trees } from '../database/schema';
import { eq, and, asc, count, isNull, sql } from 'drizzle-orm';
import type { Parcela } from '../repositories/ParcelaRepository';

export type ParcelaStats = {
  gruposCount: number;
  treesCount: number;
  pendingSyncBelow: boolean;
};

export type ParcelaWithStats = Parcela & ParcelaStats;

/** Count groups per parcela for one plantation (excluding tombstoned parcelas). */
export async function countGroupsByParcela(
  plantacionId: string,
): Promise<Array<{ parcelaId: string; count: number }>> {
  const rows = await db.select({ parcelaId: groups.parcelaId, cnt: count() })
    .from(groups)
    .innerJoin(parcelas, eq(groups.parcelaId, parcelas.id))
    .where(and(eq(parcelas.plantacionId, plantacionId), isNull(parcelas.deletedAt)))
    .groupBy(groups.parcelaId);
  return rows.map((r) => ({ parcelaId: r.parcelaId ?? '', count: r.cnt }));
}

/** Count trees per parcela for one plantation (excluding tombstoned parcelas). */
export async function countTreesByParcela(
  plantacionId: string,
): Promise<Array<{ parcelaId: string; count: number }>> {
  const rows = await db.select({ parcelaId: groups.parcelaId, cnt: count() })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .innerJoin(parcelas, eq(groups.parcelaId, parcelas.id))
    .where(and(eq(parcelas.plantacionId, plantacionId), isNull(parcelas.deletedAt)))
    .groupBy(groups.parcelaId);
  return rows.map((r) => ({ parcelaId: r.parcelaId ?? '', count: r.cnt }));
}

/** Build parcela ids that have any pending_sync=true child (group or tree). */
async function findParcelaIdsWithPendingChildren(plantacionId: string): Promise<Set<string>> {
  const groupRows = await db.select({ parcelaId: groups.parcelaId }).from(groups)
    .where(and(eq(groups.plantacionId, plantacionId), eq(groups.pendingSync, true)));
  const treeRows = await db.select({ parcelaId: groups.parcelaId })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(and(eq(groups.plantacionId, plantacionId), sql`${trees.fotoSynced} = 0`));
  const ids = new Set<string>();
  for (const r of groupRows) if (r.parcelaId) ids.add(r.parcelaId);
  for (const r of treeRows) if (r.parcelaId) ids.add(r.parcelaId);
  return ids;
}

/**
 * Lists active parcelas with per-parcela aggregated stats (gruposCount,
 * treesCount, pendingSyncBelow). Ordered by createdAt ASC. Tombstoned parcelas
 * are excluded.
 */
export async function listByPlantacionWithStats(
  plantacionId: string,
): Promise<ParcelaWithStats[]> {
  const rows = await db.select().from(parcelas)
    .where(and(eq(parcelas.plantacionId, plantacionId), isNull(parcelas.deletedAt)))
    .orderBy(asc(parcelas.createdAt));
  const grupos = await countGroupsByParcela(plantacionId);
  const trees = await countTreesByParcela(plantacionId);
  const pendingIds = await findParcelaIdsWithPendingChildren(plantacionId);
  const gMap = new Map(grupos.map((g) => [g.parcelaId, g.count]));
  const tMap = new Map(trees.map((t) => [t.parcelaId, t.count]));
  return (rows as unknown as Parcela[]).map((p) => ({
    ...p,
    gruposCount: gMap.get(p.id) ?? 0,
    treesCount: tMap.get(p.id) ?? 0,
    pendingSyncBelow: pendingIds.has(p.id),
  }));
}

/**
 * Stats for a single parcela. Returns null if the parcela is tombstoned or
 * missing.
 */
export async function getParcelaStats(parcelaId: string): Promise<ParcelaStats | null> {
  const [parcela] = await db.select({ id: parcelas.id, plantacionId: parcelas.plantacionId })
    .from(parcelas)
    .where(and(eq(parcelas.id, parcelaId), isNull(parcelas.deletedAt)))
    .limit(1);
  if (!parcela) return null;
  const [gRow] = await db.select({ cnt: count() }).from(groups)
    .where(eq(groups.parcelaId, parcelaId));
  const [tRow] = await db.select({ cnt: count() }).from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(eq(groups.parcelaId, parcelaId));
  const pendingIds = await findParcelaIdsWithPendingChildren(parcela.plantacionId);
  return {
    gruposCount: gRow?.cnt ?? 0,
    treesCount: tRow?.cnt ?? 0,
    pendingSyncBelow: pendingIds.has(parcelaId),
  };
}
