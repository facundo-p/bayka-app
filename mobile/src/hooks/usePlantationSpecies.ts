import { useState, useEffect } from 'react';
import { getSpeciesForPlantation, PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';

// Not a live query — species for a plantation are stable during a session.
export function usePlantationSpecies(plantacionId: string) {
  const [species, setSpecies] = useState<PlantationSpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSpeciesForPlantation(plantacionId).then((data) => {
      if (mounted) {
        setSpecies(data);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [plantacionId]);

  return { species, loading };
}
