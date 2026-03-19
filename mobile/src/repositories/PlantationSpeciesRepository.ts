import { db } from '../database/client';
import { plantationSpecies, species } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface PlantationSpeciesItem {
  id: string;
  plantacionId: string;
  especieId: string;
  ordenVisual: number;
  codigo: string;
  nombre: string;
}

export async function getSpeciesForPlantation(plantacionId: string): Promise<PlantationSpeciesItem[]> {
  const rows = await db
    .select({
      id: plantationSpecies.id,
      plantacionId: plantationSpecies.plantacionId,
      especieId: plantationSpecies.especieId,
      ordenVisual: plantationSpecies.ordenVisual,
      codigo: species.codigo,
      nombre: species.nombre,
    })
    .from(plantationSpecies)
    .innerJoin(species, eq(plantationSpecies.especieId, species.id))
    .where(eq(plantationSpecies.plantacionId, plantacionId))
    .orderBy(plantationSpecies.ordenVisual);

  return rows;
}
