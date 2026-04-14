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
import { useLiveData, notifyDataChanged } from '../database/liveQuery';
import { getNNTreesForPlantation, getNNTreesForPlantationByUser } from '../queries/plantationDetailQueries';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
import { useConfirm } from './useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { colors } from '../theme';
import { db } from '../database/client';
import { trees } from '../database/schema';
import { eq } from 'drizzle-orm';

interface NNTree {
  id: string;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  especieId: string | null;
  subgrupoId: string;
  subgrupoCodigo?: string;
  subgrupoNombre?: string;
  conflictEspecieId?: string | null;
  conflictEspecieNombre?: string | null;
}

export function useNNResolution(params: {
  plantacionId: string;
  subgrupoId?: string;
  subgrupoCodigo?: string;
}) {
  const { plantacionId, subgrupoId, subgrupoCodigo } = params;
  const confirm = useConfirm();
  const isPlantationMode = !subgrupoId;
  const userId = useCurrentUserId();
  const { profile } = useProfileData();
  const isAdmin = profile?.rol === 'admin';

  const singleSubgroupTrees = useTrees(subgrupoId ?? '');

  const { data: plantationNNTrees } = useLiveData(
    () => {
      if (!isPlantationMode) return Promise.resolve([]);
      if (isAdmin) return getNNTreesForPlantation(plantacionId ?? '');
      if (userId) return getNNTreesForPlantationByUser(plantacionId ?? '', userId);
      return Promise.resolve([]);
    },
    [plantacionId, isPlantationMode, isAdmin, userId]
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

  // ─── Permission check ─────────────────────────────────────────────────────
  // Admin can always resolve. Tecnico can resolve trees in their own subgroups.
  const canResolve = isAdmin || !subgrupoId; // plantation-mode: filtered by user already

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
    // Resolve with server species
    const tree = unresolvedTrees.find(t => t.id === treeId);
    const codigo = tree?.subgrupoCodigo ?? subgrupoCodigo ?? '';
    await resolveNNTree(treeId, conflict.serverEspecieId, codigo);
    // Clear conflict columns
    await db.update(trees)
      .set({ conflictEspecieId: null, conflictEspecieNombre: null })
      .where(eq(trees.id, treeId));
    notifyDataChanged();
  }

  async function keepLocalResolution(treeId: string) {
    // Just clear the conflict marker — local stays, next sync will overwrite server
    await db.update(trees)
      .set({ conflictEspecieId: null, conflictEspecieNombre: null })
      .where(eq(trees.id, treeId));
    notifyDataChanged();
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
    isAdmin,
    canResolve,
    zoomPhotoUri,
    confirmProps: confirm.confirmProps,
    // Actions
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
