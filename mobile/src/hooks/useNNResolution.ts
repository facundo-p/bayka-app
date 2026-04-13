/**
 * useNNResolution — all data logic for NNResolutionScreen.
 *
 * Encapsulates N/N tree loading, species selection, and resolution commit logic.
 * Supports both single subgroup mode and plantation-wide mode.
 */
import { useState } from 'react';
import { useTrees } from './useTrees';
import { usePlantationSpecies } from './usePlantationSpecies';
import { resolveNNTree } from '../repositories/TreeRepository';
import { useLiveData } from '../database/liveQuery';
import { getNNTreesForPlantation } from '../queries/plantationDetailQueries';
import { useConfirm } from './useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { colors } from '../theme';

interface NNTree {
  id: string;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  especieId: string | null;
  subgrupoId: string;
  subgrupoCodigo?: string;
  subgrupoNombre?: string;
}

export function useNNResolution(params: {
  plantacionId: string;
  subgrupoId?: string;
  subgrupoCodigo?: string;
}) {
  const { plantacionId, subgrupoId, subgrupoCodigo } = params;
  const confirm = useConfirm();
  const isPlantationMode = !subgrupoId;

  const singleSubgroupTrees = useTrees(subgrupoId ?? '');

  const { data: plantationNNTrees } = useLiveData(
    () => {
      if (!isPlantationMode) return Promise.resolve([]);
      return getNNTreesForPlantation(plantacionId ?? '');
    },
    [plantacionId, isPlantationMode]
  );

  let unresolvedTrees: NNTree[];
  if (isPlantationMode) {
    unresolvedTrees = (plantationNNTrees ?? []) as NNTree[];
  } else {
    unresolvedTrees = singleSubgroupTrees.allTrees
      .filter((t) => t.especieId === null)
      .map((t) => ({ ...t, subgrupoCodigo: subgrupoCodigo ?? '', subgrupoNombre: undefined }));
  }

  const { species, loading: speciesLoading } = usePlantationSpecies(plantacionId ?? '');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [zoomPhotoUri, setZoomPhotoUri] = useState<string | null>(null);

  const safeIndex = Math.min(currentIndex, unresolvedTrees.length - 1);
  const currentTree = unresolvedTrees[safeIndex];
  const total = unresolvedTrees.length;
  const currentSubgrupoCodigo = currentTree?.subgrupoCodigo ?? subgrupoCodigo ?? '';
  const currentSelectionId = selections[currentTree?.id] ?? null;

  function handleSelectSpecies(especieId: string) {
    if (!currentTree) return;
    setSelections((prev) => {
      if (prev[currentTree.id] === especieId) {
        const next = { ...prev };
        delete next[currentTree.id];
        return next;
      }
      return { ...prev, [currentTree.id]: especieId };
    });
  }

  async function handleGuardar(onAllResolved: () => void) {
    const toResolve = unresolvedTrees.filter((t) => selections[t.id]);
    if (toResolve.length === 0) {
      showInfoDialog(confirm.show, 'Seleccionar especie', 'Selecciona una especie para al menos un árbol N/N.', 'leaf-outline', colors.secondary);
      return;
    }

    setSaving(true);
    try {
      for (const tree of toResolve) {
        const speciesId = selections[tree.id];
        const codigo = tree.subgrupoCodigo ?? subgrupoCodigo ?? '';
        await resolveNNTree(tree.id, speciesId, codigo);
      }
      const resolved = new Set(toResolve.map((t) => t.id));
      setSelections((prev) => {
        const next = { ...prev };
        for (const id of resolved) delete next[id];
        return next;
      });
      if (toResolve.length === unresolvedTrees.length) {
        onAllResolved();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAnterior() {
    if (safeIndex > 0) setCurrentIndex(safeIndex - 1);
  }

  function handleSiguiente() {
    if (safeIndex < total - 1) setCurrentIndex(safeIndex + 1);
  }

  return {
    // Data
    unresolvedTrees,
    species,
    speciesLoading,
    currentTree,
    currentSubgrupoCodigo,
    currentSelectionId,
    safeIndex,
    total,
    saving,
    selections,
    isPlantationMode,
    zoomPhotoUri,
    confirmProps: confirm.confirmProps,
    // Actions
    handleSelectSpecies,
    handleGuardar,
    handleAnterior,
    handleSiguiente,
    setCurrentIndex,
    setZoomPhotoUri,
  };
}
