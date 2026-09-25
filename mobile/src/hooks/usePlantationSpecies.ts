import { useState, useEffect, useCallback } from 'react';
import { getSpeciesForPlantation, PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import { getUserSpeciesOrder } from '../repositories/UserSpeciesOrderRepository';
import { useCurrentUserId } from './useCurrentUserId';

/**
 * Returns species for a plantation, ordered by user's custom order if set,
 * otherwise alphabetically by name (#635). Species the custom order doesn't know
 * yet go last, alphabetically.
 *
 * Also provides a refresh function to re-fetch after reorder.
 */
export function usePlantationSpecies(plantacionId: string) {
  const [species, setSpecies] = useState<PlantationSpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = useCurrentUserId();

  const loadSpecies = useCallback(async () => {
    if (!plantacionId) return;
    setLoading(true);

    const adminSpecies = await getSpeciesForPlantation(plantacionId);

    if (userId) {
      const userOrder = await getUserSpeciesOrder(userId, plantacionId);
      if (userOrder.length > 0) {
        const orderMap = new Map(userOrder.map((o) => [o.especieId, o.ordenVisual]));
        const sorted = [...adminSpecies].sort((a, b) => {
          const oa = orderMap.get(a.especieId) ?? Number.MAX_SAFE_INTEGER;
          const ob = orderMap.get(b.especieId) ?? Number.MAX_SAFE_INTEGER;
          return oa - ob;
        });
        setSpecies(sorted);
        setLoading(false);
        return;
      }
    }

    setSpecies(adminSpecies);
    setLoading(false);
  }, [plantacionId, userId]);

  useEffect(() => {
    loadSpecies();
  }, [loadSpecies]);

  return { species, loading, refreshSpecies: loadSpecies };
}
