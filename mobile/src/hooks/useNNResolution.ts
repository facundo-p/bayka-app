/**
 * useNNResolution — all data logic for NNResolutionScreen.
 *
 * Encapsulates N/N tree loading, species selection, and resolution commit logic.
 * Supports both single subgroup mode and plantation-wide mode.
 */
import { useState } from 'react';
import { useTrees } from './useTrees';
import { usePlantationSpecies } from './usePlantationSpecies';
import { resolveNNTree, clearTreeConflict } from '../repositories/TreeRepository';
import { useLiveData } from '../database/liveQuery';
import { getNNTreesForPlantation } from '../queries/plantationDetailQueries';
import { useProfileData } from './useProfileData';
import { esRolAdmin } from '../types/domain';
import { useConfirm } from './useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { colors } from '../theme';

interface NNTree {
  id: string;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  especieId: string | null;
  grupoId: string;
  grupoCodigo?: string;
  grupoNombre?: string;
  parcelaNombre?: string | null;
  conflictEspecieId?: string | null;
  conflictEspecieNombre?: string | null;
}

export function useNNResolution(params: {
  plantacionId: string;
  grupoId?: string;
  grupoCodigo?: string;
}) {
  const { plantacionId, grupoId, grupoCodigo } = params;
  const confirm = useConfirm();
  const isPlantationMode = !grupoId;
  const { profile } = useProfileData();
  const isAdmin = esRolAdmin(profile?.rol);

  const singleGroupTrees = useTrees(grupoId ?? '');

  const { data: plantationNNTrees } = useLiveData(
    () => {
      if (!isPlantationMode) return Promise.resolve([]);
      // Cualquier usuario (admin o técnico) resuelve los N/N de TODA la
      // plantación, incluidos los registrados por otros usuarios.
      return getNNTreesForPlantation(plantacionId ?? '');
    },
    [plantacionId, isPlantationMode]
  );

  let unresolvedTrees: NNTree[];
  if (isPlantationMode) {
    unresolvedTrees = (plantationNNTrees ?? []) as NNTree[];
  } else {
    unresolvedTrees = singleGroupTrees.allTrees
      .filter((t) => t.especieId === null)
      .map((t) => ({ ...t, grupoCodigo: grupoCodigo ?? '', grupoNombre: undefined }));
  }

  const { species, loading: speciesLoading } = usePlantationSpecies(plantacionId ?? '');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [zoomPhotoUri, setZoomPhotoUri] = useState<string | null>(null);

  const safeIndex = Math.min(currentIndex, unresolvedTrees.length - 1);
  const currentTree = unresolvedTrees[safeIndex];
  const total = unresolvedTrees.length;
  const currentGrupoCodigo = currentTree?.grupoCodigo ?? grupoCodigo ?? '';
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
        const codigo = tree.grupoCodigo ?? grupoCodigo ?? '';
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

  // ─── Permission check ─────────────────────────────────────────────────────
  // En modo plantación cualquier usuario puede resolver N/N (incluidos los de
  // otros usuarios). En modo single-group, solo el admin (o el dueño del grupo).
  const canResolve = isAdmin || !grupoId;

  // ─── Conflict helpers ────────────────────────────────────────────────────
  function getConflictForTree(treeId: string): { serverEspecieId: string; serverEspecieNombre: string } | null {
    const tree = unresolvedTrees.find(t => t.id === treeId);
    if (tree?.conflictEspecieId) {
      return {
        serverEspecieId: tree.conflictEspecieId,
        serverEspecieNombre: tree.conflictEspecieNombre ?? 'Desconocida',
      };
    }
    return null;
  }

  async function acceptServerResolution(treeId: string) {
    const conflict = getConflictForTree(treeId);
    if (!conflict) return;
    const tree = unresolvedTrees.find(t => t.id === treeId);
    const codigo = tree?.grupoCodigo ?? grupoCodigo ?? '';
    await resolveNNTree(treeId, conflict.serverEspecieId, codigo);
    await clearTreeConflict(treeId);
  }

  async function keepLocalResolution(treeId: string) {
    // Solo limpia el marcador: lo local queda, el próximo sync sobreescribe al server
    await clearTreeConflict(treeId);
  }

  function handleAnterior() {
    if (safeIndex > 0) setCurrentIndex(safeIndex - 1);
  }

  function handleSiguiente() {
    if (safeIndex < total - 1) setCurrentIndex(safeIndex + 1);
  }

  return {
    unresolvedTrees,
    species,
    speciesLoading,
    currentTree,
    currentGrupoCodigo,
    currentSelectionId,
    safeIndex,
    total,
    saving,
    selections,
    isPlantationMode,
    isAdmin,
    canResolve,
    zoomPhotoUri,
    confirmProps: confirm.confirmProps,
    handleSelectSpecies,
    handleGuardar,
    handleAnterior,
    handleSiguiente,
    setCurrentIndex,
    setZoomPhotoUri,
    getConflictForTree,
    acceptServerResolution,
    keepLocalResolution,
  };
}
