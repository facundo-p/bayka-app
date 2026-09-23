import { db } from '../database/client';
import { plantationSpecies, species } from '../database/schema';
import { and, eq } from 'drizzle-orm';
import { soloEspeciesDelCatalogo } from '../utils/speciesHelpers';

export interface PlantationSpeciesItem {
  id: string;
  plantacionId: string;
  especieId: string;
  ordenVisual: number;
  codigo: string;
  nombre: string;
}

/** Especies para los botones de registro; una recuperada no se ofrece. */
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
    .where(and(eq(plantationSpecies.plantacionId, plantacionId), soloEspeciesDelCatalogo()))
    .orderBy(species.nombre);

  return rows;
}
