import speciesData from '../../../assets/species.json';
import { db } from '../client';
import { species } from '../schema';
import { count } from 'drizzle-orm';

export async function seedSpeciesIfNeeded(): Promise<void> {
  const [result] = await db.select({ count: count() }).from(species);
  if (result.count > 0) return; // Already seeded — idempotent

  const now = new Date().toISOString();
  await db.insert(species).values(
    speciesData.map((s: { id: string; codigo: string; nombre: string; nombre_cientifico: string | null }) => ({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      nombreCientifico: s.nombre_cientifico ?? null,
      createdAt: now,
    }))
  );
}
