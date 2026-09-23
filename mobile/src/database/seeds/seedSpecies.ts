import speciesData from '../../../assets/species.json';
import { db } from '../client';
import { species, trees, plantationSpecies, userSpeciesOrder } from '../schema';
import { and, eq, notExists, notInArray } from 'drizzle-orm';

type SpeciesEntry = { id: string; codigo: string; nombre: string; nombre_cientifico: string | null };
type LocalSpecies = { id: string; codigo: string; nombre: string; nombreCientifico: string | null };

function camposDeEspecie(s: SpeciesEntry) {
  return { codigo: s.codigo, nombre: s.nombre, nombreCientifico: s.nombre_cientifico ?? null };
}

function cambio(ex: LocalSpecies, s: SpeciesEntry): boolean {
  return ex.codigo !== s.codigo || ex.nombre !== s.nombre || ex.nombreCientifico !== (s.nombre_cientifico ?? null);
}

async function upsertCatalogo(catalog: SpeciesEntry[], existing: LocalSpecies[]): Promise<void> {
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const now = new Date().toISOString();
  for (const s of catalog) {
    const ex = existingById.get(s.id);
    if (!ex) {
      await db.insert(species).values({ id: s.id, ...camposDeEspecie(s), createdAt: now });
    } else if (cambio(ex, s)) {
      await db.update(species).set(camposDeEspecie(s)).where(eq(species.id, s.id));
    }
  }
}

/**
 * Quita las especies que salieron del catálogo, salvo las que algo referencia:
 * pueden haber bajado del server sin estar en el JSON, y borrarlas deja árboles
 * apuntando a nada (#614).
 */
async function borrarObsoletasSinUso(catalogIds: string[]): Promise<void> {
  if (catalogIds.length === 0) return;
  await db.delete(species).where(and(
    notInArray(species.id, catalogIds),
    notExists(db.select({ id: trees.id }).from(trees).where(eq(trees.especieId, species.id))),
    notExists(db.select({ id: trees.id }).from(trees).where(eq(trees.conflictEspecieId, species.id))),
    notExists(db.select({ id: plantationSpecies.id }).from(plantationSpecies).where(eq(plantationSpecies.especieId, species.id))),
    notExists(db.select({ id: userSpeciesOrder.especieId }).from(userSpeciesOrder).where(eq(userSpeciesOrder.especieId, species.id))),
  ));
}

export async function seedSpeciesIfNeeded(): Promise<void> {
  const existing = await db.select({ id: species.id, codigo: species.codigo, nombre: species.nombre, nombreCientifico: species.nombreCientifico }).from(species);
  const catalog: SpeciesEntry[] = speciesData;

  if (existing.length === 0) {
    const now = new Date().toISOString();
    await db.insert(species).values(catalog.map((s) => ({ id: s.id, ...camposDeEspecie(s), createdAt: now })));
    return;
  }
  await upsertCatalogo(catalog, existing);
  await borrarObsoletasSinUso(catalog.map((s) => s.id));
}
