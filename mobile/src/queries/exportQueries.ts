/**
 * Export query — returns all required columns for plantation export.
 *
 * Covers requirement: EXPO-03
 */
import { db } from '../database/client';
import { trees, subgroups, plantations, species } from '../database/schema';
import { eq, asc } from 'drizzle-orm';

export interface ExportRow {
  globalId: number | null;
  idParcial: number | null;
  lugar: string;
  subgrupoNombre: string;
  subId: string;
  periodo: string;
  especieNombre: string;
}

/**
 * EXPO-03
 * Returns all tree rows with required export columns, ordered by globalId ASC.
 * JOIN: trees → subgroups → plantations, trees → species.
 */
export async function getExportRows(plantacionId: string): Promise<ExportRow[]> {
  return db
    .select({
      globalId: trees.globalId,
      idParcial: trees.plantacionId,
      lugar: plantations.lugar,
      subgrupoNombre: subgroups.nombre,
      subId: trees.subId,
      periodo: plantations.periodo,
      especieNombre: species.nombre,
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .innerJoin(plantations, eq(subgroups.plantacionId, plantations.id))
    .innerJoin(species, eq(trees.especieId, species.id))
    .where(eq(subgroups.plantacionId, plantacionId))
    .orderBy(asc(trees.globalId));
}
