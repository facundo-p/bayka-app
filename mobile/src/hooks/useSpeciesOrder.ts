import { useState, useCallback } from 'react';
import { usePlantationSpecies } from './usePlantationSpecies';
import { saveUserSpeciesOrder } from '../repositories/UserSpeciesOrderRepository';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';

export interface ReorderSpeciesItem {
  especieId: string;
  nombre: string;
  codigo: string;
  ordenVisual: number;
}

export interface UseSpeciesOrderResult {
  orderedSpecies: PlantationSpeciesItem[];
  loading: boolean;
  reorderItems: ReorderSpeciesItem[];
  setReorderItems: (items: ReorderSpeciesItem[]) => void;
  initReorderFromCurrent: () => void;
  saveReorder: (userId: string, plantacionId: string) => Promise<void>;
  refreshSpecies: () => void;
}

export function useSpeciesOrder(plantacionId: string): UseSpeciesOrderResult {
  const { species: orderedSpecies, loading, refreshSpecies } = usePlantationSpecies(plantacionId);
  const [reorderItems, setReorderItems] = useState<ReorderSpeciesItem[]>([]);

  const initReorderFromCurrent = useCallback(() => {
    setReorderItems(
      orderedSpecies.map((s, i) => ({
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
      reorderItems.map((item) => ({ especieId: item.especieId, ordenVisual: item.ordenVisual }))
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
