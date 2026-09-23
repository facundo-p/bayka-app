import { db } from '../client';
import { plantations, plantationSpecies, species } from '../schema';
import { eq, count } from 'drizzle-orm';
import { DEMO_PLANTATION_ID } from './seedPlantation';
import { plantationSpeciesId } from '../../utils/plantationSpeciesId';

/** Especies de la plantación demo. Si no está (el device ya tenía plantaciones reales), nada: serían huérfanas (#616). */
export async function seedPlantationSpeciesIfNeeded(): Promise<void> {
  const [demo] = await db.select({ id: plantations.id }).from(plantations).where(eq(plantations.id, DEMO_PLANTATION_ID));
  if (!demo) return;

  const [result] = await db.select({ count: count() })
    .from(plantationSpecies)
    .where(eq(plantationSpecies.plantacionId, DEMO_PLANTATION_ID));

  if (result.count > 0) return; // Idempotent

  const allSpecies = await db.select().from(species).orderBy(species.codigo);

  await db.insert(plantationSpecies).values(
    allSpecies.map((s, i) => ({
      id: plantationSpeciesId(DEMO_PLANTATION_ID, s.id),
      plantacionId: DEMO_PLANTATION_ID,
      especieId: s.id,
      ordenVisual: i,
    }))
  );
}
