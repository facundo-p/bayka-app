/**
 * usePlantaciones — all data logic for PlantacionesScreen.
 *
 * Encapsulates plantation list, tree stats, freshness check, and pull logic.
 */
import { useState, useCallback } from 'react';
import { useLiveData, notifyDataChanged } from '../database/liveQuery';
import { useFocusEffect } from 'expo-router';
import { useCurrentUserId } from './useCurrentUserId';
import { useNetStatus } from './useNetStatus';
import { useProfileData } from './useProfileData';
import { useRoutePrefix } from './useRoutePrefix';
import { useConfirm } from './useConfirm';
import { checkFreshness } from '../queries/freshnessQueries';
import { pullFromServer, uploadPendingEdits } from '../services/SyncService';
import { deletePlantationLocally } from '../repositories/PlantationRepository';
import { getUnsyncedSubgroupSummary } from '../queries/catalogQueries';
import { showConfirmDialog, showDoubleConfirmDialog } from '../utils/alertHelpers';
import { colors } from '../theme';
import {
  getPlantationsForRole,
  getSyncedTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
  getTotalTreeCounts,
  getUnresolvedNNCountsPerPlantation,
} from '../queries/dashboardQueries';

export function usePlantaciones() {
  const routePrefix = useRoutePrefix();
  const userId = useCurrentUserId();
  const isAdmin = routePrefix === '(admin)';
  const { isOnline } = useNetStatus();
  const { profile } = useProfileData();
  const confirm = useConfirm();

  const [showFreshnessBanner, setShowFreshnessBanner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(isAdmin, userId),
    [userId, isAdmin]
  );

  const { data: syncedCounts } = useLiveData(() => getSyncedTreeCounts());
  const { data: pendingSyncCounts } = useLiveData(() => getPendingSyncCounts());
  const { data: todayCounts } = useLiveData(() => getTodayTreeCounts(userId), [userId]);
  const { data: totalCounts } = useLiveData(() => getTotalTreeCounts());
  const { data: nnCounts } = useLiveData(() => getUnresolvedNNCountsPerPlantation());

  useFocusEffect(
    useCallback(() => {
      if (!isOnline || !plantationList?.length) return;
      checkFreshness(plantationList.map((p) => p.id)).then((hasNewData) => {
        setShowFreshnessBanner(hasNewData);
      });
    }, [isOnline, plantationList])
  );

  const handleRefresh = async () => {
    if (!plantationList) return;
    setRefreshing(true);
    try {
      await uploadPendingEdits();
      for (const p of plantationList) {
        await pullFromServer(p.id);
      }
      notifyDataChanged();
      setShowFreshnessBanner(false);
    } catch (e) {
      console.error('[Freshness] pull failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const headerTitle =
    isAdmin && profile?.organizacionNombre ? profile.organizacionNombre : 'Mis plantaciones';

  const syncedCountMap = new Map<string, number>();
  if (syncedCounts) for (const row of syncedCounts) syncedCountMap.set(row.plantacionId, row.treeCount);

  const pendingSyncMap = new Map<string, number>();
  if (pendingSyncCounts) for (const row of pendingSyncCounts) pendingSyncMap.set(row.plantacionId, row.pendingCount);

  const todayCountMap = new Map<string, number>();
  if (todayCounts) for (const row of todayCounts) todayCountMap.set(row.plantacionId, row.treeCount);

  const totalCountMap = new Map<string, number>();
  if (totalCounts) for (const row of totalCounts) totalCountMap.set(row.plantacionId, row.treeCount);

  const nnCountMap = new Map<string, number>();
  if (nnCounts) for (const row of nnCounts) nnCountMap.set(row.plantacionId, row.nnCount);

  const estadoCounts = { activa: 0, finalizada: 0 };
  plantationList?.forEach((p: any) => {
    if (estadoCounts[p.estado as keyof typeof estadoCounts] !== undefined) {
      estadoCounts[p.estado as keyof typeof estadoCounts]++;
    }
  });

  const filteredList = plantationList?.filter(
    (p: any) => !activeFilter || p.estado === activeFilter
  ) ?? [];

  async function handleDeletePlantation(plantationId: string) {
    const item = plantationList?.find((p: any) => p.id === plantationId);
    if (!item) return;

    const { activaCount, finalizadaCount } = await getUnsyncedSubgroupSummary(plantationId);
    const hasUnsynced = activaCount + finalizadaCount > 0;

    if (hasUnsynced) {
      const totalUnsynced = activaCount + finalizadaCount;
      showDoubleConfirmDialog(
        confirm.show,
        'Atencion: datos sin sincronizar',
        `Esta plantacion tiene ${totalUnsynced} subgrupo${totalUnsynced !== 1 ? 's' : ''} sin subir al servidor (${activaCount} activo${activaCount !== 1 ? 's' : ''}, ${finalizadaCount} finalizado${finalizadaCount !== 1 ? 's' : ''}). Si eliminas ahora, esos datos se perderan permanentemente.`,
        'Eliminar de todas formas',
        'Los datos sin sincronizar se perderan para siempre. Esta accion no se puede deshacer.',
        async () => {
          await deletePlantationLocally(plantationId);
          notifyDataChanged();
        },
      );
    } else {
      showConfirmDialog(
        confirm.show,
        'Eliminar del dispositivo',
        `La plantacion "${item.lugar}" sera eliminada de tu celular. Podras volver a descargarla desde el catalogo.`,
        'Eliminar',
        async () => {
          await deletePlantationLocally(plantationId);
          notifyDataChanged();
        },
        { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' },
      );
    }
  }

  return {
    plantationList,
    filteredList,
    estadoCounts,
    activeFilter,
    setActiveFilter,
    showFreshnessBanner,
    refreshing,
    headerTitle,
    isOnline,
    isAdmin,
    syncedCountMap,
    pendingSyncMap,
    todayCountMap,
    totalCountMap,
    nnCountMap,
    handleRefresh,
    handleDeletePlantation,
    confirmProps: confirm.confirmProps,
  };
}
