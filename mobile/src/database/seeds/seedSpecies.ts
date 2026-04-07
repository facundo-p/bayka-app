import speciesData from '../../../assets/species.json';
import { db } from '../client';
import { species } from '../schema';
import { eq, notInArray } from 'drizzle-orm';

type SpeciesEntry = { id: string; codigo: string; nombre: string; nombre_cientifico: string | null };

export async function seedSpeciesIfNeeded(): Promise<void> {
  const existing = await db.select({ id: species.id, codigo: species.codigo, nombre: species.nombre, nombreCientifico: species.nombreCientifico }).from(species);
  const catalog: SpeciesEntry[] = speciesData;

  if (existing.length === 0) {
    // Fresh install — bulk insert
    const now = new Date().toISOString();
    await db.insert(species).values(
      catalog.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        nombre: s.nombre,
        nombreCientifico: s.nombre_cientifico ?? null,
        createdAt: now,
      }))
    );
    return;
  }

  // Sync: upsert changes and remove stale entries
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const catalogIds = catalog.map((s) => s.id);
  const now = new Date().toISOString();

  for (const s of catalog) {
    const ex = existingById.get(s.id);
    if (!ex) {
      // New species
      await db.insert(species).values({
        id: s.id,
        codigo: s.codigo,
        nombre: s.nombre,
        nombreCientifico: s.nombre_cientifico ?? null,
        createdAt: now,
      });
    } else if (ex.codigo !== s.codigo || ex.nombre !== s.nombre || ex.nombreCientifico !== (s.nombre_cientifico ?? null)) {
      // Updated species
      await db.update(species).set({
        codigo: s.codigo,
        nombre: s.nombre,
        nombreCientifico: s.nombre_cientifico ?? null,
      }).where(eq(species.id, s.id));
    }
  }

  // Remove species no longer in catalog
  if (catalogIds.length > 0) {
    await db.delete(species).where(notInArray(species.id, catalogIds));
  }
}
