import { db } from '../client';
import { plantationSpecies, species } from '../schema';
import { eq, count } from 'drizzle-orm';
import { DEMO_PLANTATION_ID } from './seedPlantation';

export async function seedPlantationSpeciesIfNeeded(): Promise<void> {
  const [result] = await db.select({ count: count() })
    .from(plantationSpecies)
    .where(eq(plantationSpecies.plantacionId, DEMO_PLANTATION_ID));

  if (result.count > 0) return; // Idempotent

  const allSpecies = await db.select().from(species).orderBy(species.codigo);

  await db.insert(plantationSpecies).values(
    allSpecies.map((s, i) => ({
      id: `ps-${DEMO_PLANTATION_ID}-${s.id}`,
      plantacionId: DEMO_PLANTATION_ID,
      especieId: s.id,
      ordenVisual: i,
    }))
  );
}
