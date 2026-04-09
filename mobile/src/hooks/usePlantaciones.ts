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
import { checkFreshness } from '../queries/freshnessQueries';
import { pullFromServer } from '../services/SyncService';
import {
  getPlantationsForRole,
  getSyncedTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
  getTotalTreeCounts,
} from '../queries/dashboardQueries';

export function usePlantaciones() {
  const routePrefix = useRoutePrefix();
  const userId = useCurrentUserId();
  const isAdmin = routePrefix === '(admin)';
  const { isOnline } = useNetStatus();
  const { profile } = useProfileData();

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

  const estadoCounts = { activa: 0, finalizada: 0 };
  plantationList?.forEach((p: any) => {
    if (estadoCounts[p.estado as keyof typeof estadoCounts] !== undefined) {
      estadoCounts[p.estado as keyof typeof estadoCounts]++;
    }
  });

  const filteredList = plantationList?.filter(
    (p: any) => !activeFilter || p.estado === activeFilter
  ) ?? [];

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
    handleRefresh,
  };
}
