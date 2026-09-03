import { eq } from 'drizzle-orm';
import { species as speciesTable } from '../database/schema';
import type { db } from '../database/client';

/** Display label/codigo for a tree whose especie is not yet resolved. */
export function getSpeciesCode(tree: {
  especieId?: string | null;
  especieCodigo?: string | null;
}): string {
  if (!tree.especieId) return 'N/N';
  return tree.especieCodigo ?? '??';
}

/** Display name for a tree whose especie is not yet resolved. */
export function getSpeciesName(tree: {
  especieId?: string | null;
  especieNombre?: string | null;
}): string {
  if (!tree.especieId) return 'N/N';
  return tree.especieNombre ?? '??';
}

/** Placeholder especie codigo embedded in a tree's subId when unresolved (N/N). */
export const UNKNOWN_SPECIES_CODE = 'NN';

type Queryable = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Resolves a tree's especie codigo for subId generation: the linked species'
 * codigo, or UNKNOWN_SPECIES_CODE when especieId is null or the species row
 * is missing. Accepts either `db` or a transaction handle.
 */
export async function resolveEspecieCodigo(
  queryable: Queryable,
  especieId: string | null,
): Promise<string> {
  if (!especieId) return UNKNOWN_SPECIES_CODE;
  const [sp] = await queryable.select({ codigo: speciesTable.codigo })
    .from(speciesTable)
    .where(eq(speciesTable.id, especieId));
  return sp?.codigo ?? UNKNOWN_SPECIES_CODE;
}
