/**
 * usePlantationDetail — all data logic for PlantationDetailScreen.
 *
 * Encapsulates subgroup list, N/N counts, tree counts, plantation estado,
 * and subgroup editing/deletion logic.
 */
import { useState, useMemo } from 'react';
import { useLiveData } from '../database/liveQuery';
import {
  deleteGroup,
  updateGroup,
  updateGroupCode,
} from '../repositories/GroupRepository';
import {
  getPlantationLugar,
  getGroupsForPlantation,
  getNNCountsPerGroup,
  getTreeCountsPerGroup,
} from '../queries/plantationDetailQueries';
import { getPlantationEstado } from '../queries/adminQueries';
import { useCurrentUserId } from './useCurrentUserId';
import { useUserNames } from './useUserNames';
import { showDoubleConfirmDialog } from '../utils/alertHelpers';
import { useConfirm } from './useConfirm';
import type { Group, GroupTipo } from '../repositories/GroupRepository';
import { ESTADO_PLANTACION, ESTADO_GRUPO } from '../constants/estados';
import { findById as findParcelaById } from '../repositories/ParcelaRepository';
import type { Parcela } from '../repositories/ParcelaRepository';

// Re-export types for consumers of this hook (avoids repository imports in screens)
export type { Group, GroupTipo };

export function usePlantationDetail(plantacionId: string, parcelaId?: string) {
  const userId = useCurrentUserId();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const confirm = useConfirm();

  const pid = plantacionId ?? '';

  const { data: plantationRows } = useLiveData(() => getPlantationLugar(pid), [pid]);
  const { data: groupRows } = useLiveData(
    () => getGroupsForPlantation(pid, parcelaId),
    [pid, parcelaId],
  );
  const { data: nnCounts } = useLiveData(() => getNNCountsPerGroup(pid), [pid]);
  const { data: treeCounts } = useLiveData(() => getTreeCountsPerGroup(pid), [pid]);
  const { data: parcelaRows } = useLiveData(
    () => (parcelaId ? findParcelaById(parcelaId).then((p) => (p ? [p] : [])) : Promise.resolve([])),
    [parcelaId],
  );
  const parcela: Parcela | null = (parcelaRows?.[0] as Parcela | undefined) ?? null;

  const { data: estadoData } = useLiveData(
    () => getPlantationEstado(pid).then((e) => [{ estado: e ?? '' }]),
    [pid]
  );
  const plantacionEstado = estadoData?.[0]?.estado ?? '';
  const estadoLoaded = estadoData !== undefined;
  const isFinalizada = plantacionEstado === ESTADO_PLANTACION.finalizada;

  const creatorIds = useMemo(() => {
    const ids = (groupRows ?? []).map((sg: any) => sg.usuarioCreador).filter(Boolean);
    return [...new Set(ids)] as string[];
  }, [groupRows]);
  const userNames = useUserNames(creatorIds);

  const nnCountMap = new Map<string, number>();
  if (nnCounts) {
    for (const row of nnCounts) {
      nnCountMap.set(row.grupoId, row.nnCount);
    }
  }

  const treeCountMap = new Map<string, number>();
  if (treeCounts) {
    for (const row of treeCounts) {
      treeCountMap.set(row.grupoId, row.treeCount);
    }
  }

  const totalNN = Array.from(nnCountMap.values()).reduce((sum, v) => sum + v, 0);

  const groupEstadoCounts = { activa: 0, finalizada: 0 };
  (groupRows ?? []).forEach((sg: any) => {
    if (groupEstadoCounts[sg.estado as keyof typeof groupEstadoCounts] !== undefined) {
      groupEstadoCounts[sg.estado as keyof typeof groupEstadoCounts]++;
    }
  });

  const filteredGroups = ((groupRows ?? []) as Group[]).filter(
    sg => !groupFilter || sg.estado === groupFilter
  );

  function handleLongPress(subgroup: Group) {
    const isOwner = userId ? subgroup.usuarioCreador === userId : false;
    if (!isOwner || subgroup.estado !== ESTADO_GRUPO.activa) return;
    setEditingGroup(subgroup);
  }

  function handleDeleteGroup(subgroup: Group) {
    const treeCount = treeCountMap.get(subgroup.id) ?? 0;
    const warningMessage = treeCount > 0
      ? `Este grupo tiene ${treeCount} árbol${treeCount > 1 ? 'es' : ''} cargado${treeCount > 1 ? 's' : ''}. Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.';

    showDoubleConfirmDialog(
      confirm.show,
      'Eliminar grupo',
      warningMessage,
      'Confirmar eliminación',
      'Esta es la confirmación final. El grupo y todos sus árboles serán eliminados permanentemente.',
      async () => {
        setDeletingId(subgroup.id);
        try {
          await deleteGroup(subgroup.id);
        } finally {
          setDeletingId(null);
        }
      },
    );
  }

  async function handleEditSubmit(values: { nombre: string; codigo: string; tipo: GroupTipo }) {
    if (!editingGroup) return { success: false as const, error: 'unknown' as const };
    const result = await updateGroup(editingGroup.id, values);
    if (result.success && values.codigo !== editingGroup.codigo) {
      await updateGroupCode(editingGroup.id, values.codigo, editingGroup.codigo);
    }
    if (result.success) {
      setEditingGroup(null);
    }
    return result;
  }

  return {
    plantationRows,
    parcela,
    groupRows,
    filteredGroups,
    nnCountMap,
    treeCountMap,
    totalNN,
    groupEstadoCounts,
    plantacionEstado,
    estadoLoaded,
    isFinalizada,
    userNames,
    deletingId,
    editingGroup,
    groupFilter,
    confirmProps: confirm.confirmProps,
    confirmShow: confirm.show,
    userId,
    setGroupFilter,
    setEditingGroup,
    handleLongPress,
    handleDeleteGroup,
    handleEditSubmit,
  };
}
