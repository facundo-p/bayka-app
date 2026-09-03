import { db } from '../database/client';
import { trees, species as speciesTable, groups } from '../database/schema';
import { eq, max, asc, and, isNotNull } from 'drizzle-orm';
import { generateSubId } from '../utils/idGenerator';
import { computeReversedPositions } from '../utils/reverseOrder';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import { localNow } from '../utils/dateUtils';
import { markGroupPendingSync, getGroupParcelaCodigo } from './GroupRepository';
import { isLocalUri } from '../utils/photoUri';
import { resolveEspecieCodigo } from '../utils/speciesHelpers';

export interface InsertTreeParams {
  grupoId: string;
  grupoCodigo: string;
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
    .where(eq(trees.groupId, params.grupoId));

  const nextPosition = (maxResult?.maxPos ?? 0) + 1;
  const parcelaCodigo = await getGroupParcelaCodigo(params.grupoId);
  const subId = generateSubId(parcelaCodigo, params.grupoCodigo, params.especieCodigo, nextPosition);

  const id = Crypto.randomUUID();
  await db.insert(trees).values({
    id,
    groupId: params.grupoId,
    especieId: params.especieId,
    posicion: nextPosition,
    subId,
    fotoUrl: params.fotoUrl ?? null,
    usuarioRegistro: params.userId,
    createdAt: localNow(),
  });

  await markGroupPendingSync(params.grupoId);
  notifyDataChanged();
  return { id, posicion: nextPosition, subId };
}

export async function deleteLastTree(grupoId: string): Promise<{ deleted: boolean }> {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion), id: trees.id })
    .from(trees)
    .where(eq(trees.groupId, grupoId));

  if (maxResult?.id == null) return { deleted: false };

  await db.delete(trees).where(eq(trees.id, maxResult.id));
  await markGroupPendingSync(grupoId);
  notifyDataChanged();
  return { deleted: true };
}

export async function reverseTreeOrder(
  grupoId: string,
  grupoCodigo: string
): Promise<void> {
  const allTrees = await db.select().from(trees)
    .where(eq(trees.groupId, grupoId));

  if (allTrees.length === 0) return;

  const reversed = computeReversedPositions(allTrees);
  const parcelaCodigo = await getGroupParcelaCodigo(grupoId);

  await db.transaction(async (tx) => {
    for (const { id, newPosicion } of reversed) {
      const tree = allTrees.find((t) => t.id === id)!;
      const especieCodigo = await resolveEspecieCodigo(tx, tree.especieId);
      const newSubId = generateSubId(parcelaCodigo, grupoCodigo, especieCodigo, newPosicion);
      await tx.update(trees)
        .set({ posicion: newPosicion, subId: newSubId })
        .where(eq(trees.id, id));
    }
  });
  await markGroupPendingSync(grupoId);
  notifyDataChanged();
}

export async function resolveNNTree(
  treeId: string,
  especieId: string,
  grupoCodigo: string
): Promise<void> {
  const [sp] = await db.select({ codigo: speciesTable.codigo })
    .from(speciesTable)
    .where(eq(speciesTable.id, especieId));

  const [tree] = await db.select({ posicion: trees.posicion, grupoId: trees.groupId })
    .from(trees)
    .where(eq(trees.id, treeId));

  if (!sp || !tree) return;

  const parcelaCodigo = await getGroupParcelaCodigo(tree.grupoId);
  const newSubId = generateSubId(parcelaCodigo, grupoCodigo, sp.codigo, tree.posicion);

  await db.update(trees)
    .set({ especieId, subId: newSubId })
    .where(eq(trees.id, treeId));
  await markGroupPendingSync(tree.grupoId);
  notifyDataChanged();
}

export interface TreeGpsPoint {
  latitude: number;
  longitude: number;
  gpsAccuracy: number | null;
  /** Momento del tap de registro (ISO local), no el momento en que resolvió el fix. */
  gpsCapturedAt: string;
}

/**
 * Adjunta (o reemplaza) el punto GPS de un árbol. Llega async después del alta
 * (el fix puede resolver cuando el técnico ya registró el siguiente árbol).
 * Re-marca el grupo pendiente de sync: si el fix resuelve después de un push
 * (o el grupo ya estaba sincronizado, caso re-captura), nada más lo re-subiría.
 */
export async function updateTreeGps(treeId: string, point: TreeGpsPoint): Promise<void> {
  const [treeRow] = await db.select({ grupoId: trees.groupId }).from(trees).where(eq(trees.id, treeId));
  if (!treeRow) return; // árbol deshecho antes de que llegara el fix
  await db.update(trees).set(point).where(eq(trees.id, treeId));
  await markGroupPendingSync(treeRow.grupoId);
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
  const [treeRow] = await db.select({ grupoId: trees.groupId }).from(trees).where(eq(trees.id, treeId));
  if (treeRow) await markGroupPendingSync(treeRow.grupoId);
  notifyDataChanged();
}

/**
 * Returns trees with local photos not yet uploaded to Storage.
 * Only includes trees in synced groups (pendingSync=false) for the given plantation.
 * Filters to file:// URIs only — remote paths from pull should not be re-uploaded (Pitfall 2).
 */
export async function getTreesWithPendingPhotos(plantacionId: string): Promise<Array<{
  id: string;
  fotoUrl: string;
  grupoId: string;
  plantacionId: string;
  parcelaId: string | null;
}>> {
  const rows = await db
    .select({
      id: trees.id,
      fotoUrl: trees.fotoUrl,
      grupoId: trees.groupId,
      plantacionId: groups.plantacionId,
      parcelaId: groups.parcelaId,
    })
    .from(trees)
    .innerJoin(groups, eq(trees.groupId, groups.id))
    .where(
      and(
        eq(groups.plantacionId, plantacionId),
        // Removed: eq(groups.pendingSync, false)
        // Photo upload must work regardless of subgroup sync state.
        // Trees from failed RPC calls also need their photos uploaded.
        isNotNull(trees.fotoUrl),
        eq(trees.fotoSynced, false)
      )
    );
  return rows.filter(r => isLocalUri(r.fotoUrl)) as Array<{
    id: string;
    fotoUrl: string;
    grupoId: string;
    plantacionId: string;
    parcelaId: string | null;
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
 * Clears a tree's N/N sync conflict marker (server-vs-local especie mismatch
 * flagged during pull). Used both when accepting the server's resolution and
 * when keeping the local one — either way the conflict is resolved.
 */
export async function clearTreeConflict(treeId: string): Promise<void> {
  await db.update(trees)
    .set({ conflictEspecieId: null, conflictEspecieNombre: null })
    .where(eq(trees.id, treeId));
  notifyDataChanged();
}

/**
 * Deletes a single tree and recalculates positions + subIds for all
 * remaining trees in the subgroup so they stay consecutive (1, 2, 3...).
 */
export async function deleteTreeAndRecalculate(
  treeId: string,
  grupoId: string,
  grupoCodigo: string
): Promise<void> {
  await db.delete(trees).where(eq(trees.id, treeId));

  // Fetch remaining trees ordered by current position
  const remaining = await db.select().from(trees)
    .where(eq(trees.groupId, grupoId))
    .orderBy(asc(trees.posicion));

  const parcelaCodigo = await getGroupParcelaCodigo(grupoId);

  // Recalculate positions and subIds
  await db.transaction(async (tx) => {
    for (let i = 0; i < remaining.length; i++) {
      const tree = remaining[i];
      const newPos = i + 1;
      const especieCodigo = await resolveEspecieCodigo(tx, tree.especieId);
      const newSubId = generateSubId(parcelaCodigo, grupoCodigo, especieCodigo, newPos);
      await tx.update(trees)
        .set({ posicion: newPos, subId: newSubId })
        .where(eq(trees.id, tree.id));
    }
  });

  await markGroupPendingSync(grupoId);
  notifyDataChanged();
}
