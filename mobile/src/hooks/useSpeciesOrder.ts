import { useState, useCallback } from 'react';
import { usePlantationSpecies } from './usePlantationSpecies';
import { saveUserSpeciesOrder } from '../repositories/UserSpeciesOrderRepository';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import type { ReorderItem } from '../components/SpeciesReorderList';

export interface UseSpeciesOrderResult {
  orderedSpecies: PlantationSpeciesItem[];
  loading: boolean;
  reorderItems: ReorderItem[];
  setReorderItems: (items: ReorderItem[]) => void;
  initReorderFromCurrent: () => void;
  saveReorder: (userId: string, plantacionId: string) => Promise<void>;
  refreshSpecies: () => void;
}

export function useSpeciesOrder(plantacionId: string): UseSpeciesOrderResult {
  const { species: orderedSpecies, loading, refreshSpecies } = usePlantationSpecies(plantacionId);
  const [reorderItems, setReorderItems] = useState<ReorderItem[]>([]);

  const initReorderFromCurrent = useCallback(() => {
    setReorderItems(
      orderedSpecies.map((s: PlantationSpeciesItem, i: number) => ({
        especieId: s.especieId,
        nombre: s.nombre,
        codigo: s.codigo,
        ordenVisual: i,
      }))
    );
  }, [orderedSpecies]);

  const saveReorder = useCallback(async (userId: string, plantacionId: string) => {
    if (!userId || !plantacionId) return;
    await saveUserSpeciesOrder(
      userId,
      plantacionId,
      reorderItems.map((item: ReorderItem) => ({ especieId: item.especieId, ordenVisual: item.ordenVisual }))
    );
    refreshSpecies();
  }, [reorderItems, refreshSpecies]);

  return {
    orderedSpecies,
    loading,
    reorderItems,
    setReorderItems,
    initReorderFromCurrent,
    saveReorder,
    refreshSpecies,
  };
}
