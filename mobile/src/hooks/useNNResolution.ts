/**
 * useNNResolution — all data logic for NNResolutionScreen.
 *
 * Encapsulates N/N tree loading, species selection, and resolution commit logic.
 * Supports both single subgroup mode and plantation-wide mode.
 */
import { useState } from 'react';
import { useTrees } from './useTrees';
import { usePlantationSpecies } from './usePlantationSpecies';
import { cambiarEspecie } from '../repositories/TreeRepository';
import { useLiveData } from '../database/liveQuery';
import { getNNTreesForPlantation } from '../queries/plantationDetailQueries';
import { getPlantationEstadoDeEdicion } from '../queries/adminQueries';
import { plantacionEsEditable, puedeEditarArbolesDelGrupo } from '../utils/permisosDeEdicion';
import { useProfileData } from './useProfileData';
import { useCurrentUserId } from './useCurrentUserId';
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
  /** Solo en modo plantación: decide si un técnico lo resuelve (#768). */
  grupoCreador?: string;
  parcelaNombre?: string | null;
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
  const userId = useCurrentUserId();

  const singleGroupTrees = useTrees(grupoId ?? '');

  const { data: plantationNNTrees } = useLiveData(
    () => {
      if (!isPlantationMode) return Promise.resolve([]);
      // Se ven los N/N de TODA la plantación; un técnico resuelve solo los de sus grupos.
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

  // Resolver escribe árboles: no aplica sobre una plantación finalizada o archivada
  // (#477). Hasta que carga, no se resuelve.
  const { data: estadoDeEdicion } = useLiveData(
    () => getPlantationEstadoDeEdicion(plantacionId ?? ''),
    [plantacionId]
  );
  const plantacionEditable = estadoDeEdicion != null && plantacionEsEditable(estadoDeEdicion);

  // Modo plantación: admin cualquiera, técnico los de sus grupos (#768). Modo
  // single-group: solo el admin.
  function puedeResolver(tree: NNTree | undefined): boolean {
    if (estadoDeEdicion == null) return false;
    const isCreator = isPlantationMode && tree != null && userId != null && tree.grupoCreador === userId;
    return puedeEditarArbolesDelGrupo({ plantacion: estadoDeEdicion, isCreator, esAdmin: isAdmin });
  }

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
    if (!plantacionEditable) return;
    const toResolve = unresolvedTrees.filter((t) => selections[t.id] && puedeResolver(t));
    if (toResolve.length === 0) {
      showInfoDialog(confirm.show, 'Seleccionar especie', 'Selecciona una especie para al menos un árbol N/N.', 'leaf-outline', colors.secondary);
      return;
    }

    setSaving(true);
    try {
      for (const tree of toResolve) {
        await cambiarEspecie(tree.id, selections[tree.id]);
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

  const canResolve = puedeResolver(currentTree);

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
  };
}
