/**
 * usePlantationDetail — all data logic for PlantationDetailScreen.
 *
 * Encapsulates subgroup list, N/N counts, tree counts, plantation estado,
 * and subgroup editing/deletion logic.
 */
import { useState, useMemo } from 'react';
import { useLiveData } from '../database/liveQuery';
import {
  deleteSubGroup,
  updateSubGroup,
  updateSubGroupCode,
} from '../repositories/SubGroupRepository';
import {
  getPlantationLugar,
  getSubgroupsForPlantation,
  getNNCountsPerSubgroup,
  getTreeCountsPerSubgroup,
} from '../queries/plantationDetailQueries';
import { getPlantationEstado } from '../queries/adminQueries';
import { useCurrentUserId } from './useCurrentUserId';
import { useUserNames } from './useUserNames';
import { showDoubleConfirmDialog } from '../utils/alertHelpers';
import { useConfirm } from './useConfirm';
import type { SubGroup, SubGroupTipo } from '../repositories/SubGroupRepository';

// Re-export types for consumers of this hook (avoids repository imports in screens)
export type { SubGroup, SubGroupTipo };

export function usePlantationDetail(plantacionId: string) {
  const userId = useCurrentUserId();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSubGroup, setEditingSubGroup] = useState<SubGroup | null>(null);
  const [subgroupFilter, setSubgroupFilter] = useState<string | null>(null);
  const confirm = useConfirm();

  const pid = plantacionId ?? '';

  const { data: plantationRows } = useLiveData(() => getPlantationLugar(pid), [pid]);
  const { data: subgroupRows } = useLiveData(() => getSubgroupsForPlantation(pid), [pid]);
  const { data: nnCounts } = useLiveData(() => getNNCountsPerSubgroup(pid), [pid]);
  const { data: treeCounts } = useLiveData(() => getTreeCountsPerSubgroup(pid), [pid]);

  const { data: estadoData } = useLiveData(
    () => getPlantationEstado(pid).then((e) => [{ estado: e ?? '' }]),
    [pid]
  );
  const plantacionEstado = estadoData?.[0]?.estado ?? '';
  const estadoLoaded = estadoData !== undefined;
  const isFinalizada = plantacionEstado === 'finalizada';

  const creatorIds = useMemo(() => {
    const ids = (subgroupRows ?? []).map((sg: any) => sg.usuarioCreador).filter(Boolean);
    return [...new Set(ids)] as string[];
  }, [subgroupRows]);
  const userNames = useUserNames(creatorIds);

  // Build maps
  const nnCountMap = new Map<string, number>();
  if (nnCounts) {
    for (const row of nnCounts) {
      nnCountMap.set(row.subgrupoId, row.nnCount);
    }
  }

  const treeCountMap = new Map<string, number>();
  if (treeCounts) {
    for (const row of treeCounts) {
      treeCountMap.set(row.subgrupoId, row.treeCount);
    }
  }

  const totalNN = Array.from(nnCountMap.values()).reduce((sum, v) => sum + v, 0);

  const subgroupEstadoCounts = { activa: 0, finalizada: 0, sincronizada: 0 };
  (subgroupRows ?? []).forEach((sg: any) => {
    if (subgroupEstadoCounts[sg.estado as keyof typeof subgroupEstadoCounts] !== undefined) {
      subgroupEstadoCounts[sg.estado as keyof typeof subgroupEstadoCounts]++;
    }
  });

  const filteredSubgroups = ((subgroupRows ?? []) as SubGroup[]).filter(
    sg => !subgroupFilter || sg.estado === subgroupFilter
  );

  function handleLongPress(subgroup: SubGroup) {
    const isOwner = userId ? subgroup.usuarioCreador === userId : false;
    if (!isOwner || subgroup.estado !== 'activa') return;
    setEditingSubGroup(subgroup);
  }

  function handleDeleteSubGroup(subgroup: SubGroup) {
    const treeCount = treeCountMap.get(subgroup.id) ?? 0;
    const warningMessage = treeCount > 0
      ? `Este subgrupo tiene ${treeCount} árbol${treeCount > 1 ? 'es' : ''} cargado${treeCount > 1 ? 's' : ''}. Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.';

    showDoubleConfirmDialog(
      confirm.show,
      'Eliminar subgrupo',
      warningMessage,
      'Confirmar eliminación',
      'Esta es la confirmación final. El subgrupo y todos sus árboles serán eliminados permanentemente.',
      async () => {
        setDeletingId(subgroup.id);
        try {
          await deleteSubGroup(subgroup.id);
        } finally {
          setDeletingId(null);
        }
      },
    );
  }

  async function handleEditSubmit(values: { nombre: string; codigo: string; tipo: SubGroupTipo }) {
    if (!editingSubGroup) return { success: false as const, error: 'unknown' as const };
    const result = await updateSubGroup(editingSubGroup.id, values);
    if (result.success && values.codigo !== editingSubGroup.codigo) {
      await updateSubGroupCode(editingSubGroup.id, values.codigo, editingSubGroup.codigo);
    }
    if (result.success) {
      setEditingSubGroup(null);
    }
    return result;
  }

  return {
    // Data
    plantationRows,
    subgroupRows,
    filteredSubgroups,
    nnCountMap,
    treeCountMap,
    totalNN,
    subgroupEstadoCounts,
    plantacionEstado,
    estadoLoaded,
    isFinalizada,
    userNames,
    // State
    deletingId,
    editingSubGroup,
    subgroupFilter,
    confirmProps: confirm.confirmProps,
    confirmShow: confirm.show,
    userId,
    // Actions
    setSubgroupFilter,
    setEditingSubGroup,
    handleLongPress,
    handleDeleteSubGroup,
    handleEditSubmit,
  };
}
