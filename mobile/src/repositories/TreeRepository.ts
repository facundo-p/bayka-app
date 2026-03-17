import { db } from '../database/client';
import { trees, species as speciesTable } from '../database/schema';
import { eq, max } from 'drizzle-orm';
import { generateSubId } from '../utils/idGenerator';
import { computeReversedPositions } from '../utils/reverseOrder';

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

  const id = crypto.randomUUID();
  await db.insert(trees).values({
    id,
    subgrupoId: params.subgrupoId,
    especieId: params.especieId,
    posicion: nextPosition,
    subId,
    fotoUrl: params.fotoUrl ?? null,
    usuarioRegistro: params.userId,
    createdAt: new Date().toISOString(),
  });

  return { id, posicion: nextPosition, subId };
}

export async function deleteLastTree(subgrupoId: string): Promise<{ deleted: boolean }> {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion), id: trees.id })
    .from(trees)
    .where(eq(trees.subgrupoId, subgrupoId));

  if (maxResult?.id == null) return { deleted: false };

  await db.delete(trees).where(eq(trees.id, maxResult.id));
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
}

export async function resolveNNTree(
  treeId: string,
  especieId: string,
  subgrupoCodigo: string
): Promise<void> {
  const [sp] = await db.select({ codigo: speciesTable.codigo })
    .from(speciesTable)
    .where(eq(speciesTable.id, especieId));

  const [tree] = await db.select({ posicion: trees.posicion })
    .from(trees)
    .where(eq(trees.id, treeId));

  if (!sp || !tree) return;

  const newSubId = generateSubId(subgrupoCodigo, sp.codigo, tree.posicion);

  await db.update(trees)
    .set({ especieId, subId: newSubId })
    .where(eq(trees.id, treeId));
}

/**
 * Attaches or replaces the photo for any tree (optional, non-N/N trees).
 * Called from the tree registration screen camera icon handler.
 */
export async function updateTreePhoto(treeId: string, fotoUrl: string): Promise<void> {
  await db.update(trees)
    .set({ fotoUrl })
    .where(eq(trees.id, treeId));
}
