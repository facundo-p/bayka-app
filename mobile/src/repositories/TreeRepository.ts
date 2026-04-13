import { db } from '../database/client';
import { trees, species as speciesTable, subgroups } from '../database/schema';
import { eq, max, asc, and, isNotNull } from 'drizzle-orm';
import { generateSubId } from '../utils/idGenerator';
import { computeReversedPositions } from '../utils/reverseOrder';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { markSubGroupPendingSync } from './SubGroupRepository';

export interface InsertTreeParams {
  subgrupoId: string;
  subgrupoCodigo: string;
  especieId: string | null;  // null for N/N
  especieCodigo: string;     // 'NN' for N/N
  fotoUrl?: string | null;
  userId: string;
}

export interface InsertTreeResult {
  id: string;
  posicion: number;
  subId: string;
}

export async function insertTree(params: InsertTreeParams): Promise<InsertTreeResult> {
  // CRITICAL: Always query MAX from DB — never trust React state (Pitfall 2)
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion) })
    .from(trees)
    .where(eq(trees.subgrupoId, params.subgrupoId));

  const nextPosition = (maxResult?.maxPos ?? 0) + 1;
  const subId = generateSubId(params.subgrupoCodigo, params.especieCodigo, nextPosition);

  const id = Crypto.randomUUID();
  await db.insert(trees).values({
    id,
    subgrupoId: params.subgrupoId,
    especieId: params.especieId,
    posicion: nextPosition,
    subId,
    fotoUrl: params.fotoUrl ?? null,
    usuarioRegistro: params.userId,
    createdAt: localNow(),
  });

  await markSubGroupPendingSync(params.subgrupoId);
  notifyDataChanged();
  return { id, posicion: nextPosition, subId };
}

export async function deleteLastTree(subgrupoId: string): Promise<{ deleted: boolean }> {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion), id: trees.id })
    .from(trees)
    .where(eq(trees.subgrupoId, subgrupoId));

  if (maxResult?.id == null) return { deleted: false };

  await db.delete(trees).where(eq(trees.id, maxResult.id));
  await markSubGroupPendingSync(subgrupoId);
  notifyDataChanged();
  return { deleted: true };
}

export async function reverseTreeOrder(
  subgrupoId: string,
  subgrupoCodigo: string
): Promise<void> {
  const allTrees = await db.select().from(trees)
    .where(eq(trees.subgrupoId, subgrupoId));

  if (allTrees.length === 0) return;

  const reversed = computeReversedPositions(allTrees);

  await db.transaction(async (tx) => {
    for (const { id, newPosicion } of reversed) {
      const tree = allTrees.find((t) => t.id === id)!;

      let especieCodigo = 'NN';
      if (tree.especieId) {
        const [sp] = await tx.select({ codigo: speciesTable.codigo })
          .from(speciesTable)
          .where(eq(speciesTable.id, tree.especieId));
        especieCodigo = sp?.codigo ?? 'NN';
      }

      const newSubId = generateSubId(subgrupoCodigo, especieCodigo, newPosicion);
      await tx.update(trees)
        .set({ posicion: newPosicion, subId: newSubId })
        .where(eq(trees.id, id));
    }
  });
  await markSubGroupPendingSync(subgrupoId);
  notifyDataChanged();
}

export async function resolveNNTree(
  treeId: string,
  especieId: string,
  subgrupoCodigo: string
): Promise<void> {
  const [sp] = await db.select({ codigo: speciesTable.codigo })
    .from(speciesTable)
    .where(eq(speciesTable.id, especieId));

  const [tree] = await db.select({ posicion: trees.posicion, subgrupoId: trees.subgrupoId })
    .from(trees)
    .where(eq(trees.id, treeId));

  if (!sp || !tree) return;

  const newSubId = generateSubId(subgrupoCodigo, sp.codigo, tree.posicion);

  await db.update(trees)
    .set({ especieId, subId: newSubId })
    .where(eq(trees.id, treeId));
  await markSubGroupPendingSync(tree.subgrupoId);
  notifyDataChanged();
}

/**
 * Attaches, replaces, or removes the photo for any tree.
 * Pass empty string to remove the photo.
 * CRITICAL (Pitfall 6): Always reset fotoSynced to false on photo replacement —
 * the new local file must be re-uploaded to Storage.
 */
export async function updateTreePhoto(treeId: string, fotoUrl: string): Promise<void> {
  await db.update(trees)
    .set({ fotoUrl: fotoUrl || null, fotoSynced: false })
    .where(eq(trees.id, treeId));
  const [treeRow] = await db.select({ subgrupoId: trees.subgrupoId }).from(trees).where(eq(trees.id, treeId));
  if (treeRow) await markSubGroupPendingSync(treeRow.subgrupoId);
  notifyDataChanged();
}

/**
 * Returns trees with local photos not yet uploaded to Storage.
 * Only includes trees in synced subgroups (pendingSync=false) for the given plantation.
 * Filters to file:// URIs only — remote paths from pull should not be re-uploaded (Pitfall 2).
 */
export async function getTreesWithPendingPhotos(plantacionId: string): Promise<Array<{
  id: string;
  fotoUrl: string;
  subgrupoId: string;
  plantacionId: string;
}>> {
  const rows = await db
    .select({
      id: trees.id,
      fotoUrl: trees.fotoUrl,
      subgrupoId: trees.subgrupoId,
      plantacionId: subgroups.plantacionId,
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(
      and(
        eq(subgroups.plantacionId, plantacionId),
        eq(subgroups.pendingSync, false),
        isNotNull(trees.fotoUrl),
        eq(trees.fotoSynced, false)
      )
    );
  // Filter to local files only (remote paths from pull should not be re-uploaded)
  return rows.filter(r => r.fotoUrl?.startsWith('file://')) as Array<{
    id: string;
    fotoUrl: string;
    subgrupoId: string;
    plantacionId: string;
  }>;
}

/**
 * Marks a tree's photo as synced (uploaded to Supabase Storage).
 */
export async function markPhotoSynced(treeId: string): Promise<void> {
  await db.update(trees)
    .set({ fotoSynced: true })
    .where(eq(trees.id, treeId));
}

/**
 * Deletes a single tree and recalculates positions + subIds for all
 * remaining trees in the subgroup so they stay consecutive (1, 2, 3...).
 */
export async function deleteTreeAndRecalculate(
  treeId: string,
  subgrupoId: string,
  subgrupoCodigo: string
): Promise<void> {
  await db.delete(trees).where(eq(trees.id, treeId));

  // Fetch remaining trees ordered by current position
  const remaining = await db.select().from(trees)
    .where(eq(trees.subgrupoId, subgrupoId))
    .orderBy(asc(trees.posicion));

  // Recalculate positions and subIds
  await db.transaction(async (tx) => {
    for (let i = 0; i < remaining.length; i++) {
      const tree = remaining[i];
      const newPos = i + 1;

      let especieCodigo = 'NN';
      if (tree.especieId) {
        const [sp] = await tx.select({ codigo: speciesTable.codigo })
          .from(speciesTable)
          .where(eq(speciesTable.id, tree.especieId));
        especieCodigo = sp?.codigo ?? 'NN';
      }

      const newSubId = generateSubId(subgrupoCodigo, especieCodigo, newPos);
      await tx.update(trees)
        .set({ posicion: newPos, subId: newSubId })
        .where(eq(trees.id, tree.id));
    }
  });

  await markSubGroupPendingSync(subgrupoId);
  notifyDataChanged();
}
