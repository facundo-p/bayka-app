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
import { esRutaAdmin } from '../constants/rutas';
import { useConfirm } from './useConfirm';
import { useEliminarDelDispositivo } from './useEliminarDelDispositivo';
import { useDescartarPendientes } from './useDescartarPendientes';
import { getPendientesVarados, type PendientesVarados } from '../queries/pendientesVaradosQueries';
import { checkFreshness } from '../queries/freshnessQueries';
import { ensureServerSession, pullFromServer, uploadPendingEdits } from '../services/SyncService';
import { contarPorEstado } from '../utils/conteoPorEstado';
import {
  getPlantationsForRole,
  getSyncedTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
  getTotalTreeCounts,
  getUnresolvedNNCountsPerPlantation,
} from '../queries/dashboardQueries';

const SIN_VARADOS = new Map<string, PendientesVarados>();

export function usePlantaciones() {
  const routePrefix = useRoutePrefix();
  const userId = useCurrentUserId();
  const isAdmin = esRutaAdmin(routePrefix);
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
  const { data: pendientesVarados } = useLiveData(() => getPendientesVarados());

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
      // Sin sesión las ediciones saldrían como anon y el pull leería vacío (#658).
      await ensureServerSession();
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

  // Título fijo para ambos roles; el nombre de la organización va de subtítulo
  // (se oculta solo si el perfil aún no trae la organización).
  const headerTitle = 'Plantaciones';
  const headerSubtitle = profile?.organizacionNombre || undefined;

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

  const estadoCounts = contarPorEstado(plantationList);

  const filteredList = plantationList?.filter(
    (p: any) => !activeFilter || p.estado === activeFilter
  ) ?? [];

  const handleDeletePlantation = useEliminarDelDispositivo(confirm.show);
  const handleDescartarPendientes = useDescartarPendientes(confirm.show);

  return {
    plantationList,
    filteredList,
    estadoCounts,
    activeFilter,
    setActiveFilter,
    showFreshnessBanner,
    refreshing,
    headerTitle,
    headerSubtitle,
    isOnline,
    isAdmin,
    syncedCountMap,
    pendingSyncMap,
    todayCountMap,
    totalCountMap,
    nnCountMap,
    handleRefresh,
    handleDeletePlantation,
    pendientesVarados: pendientesVarados ?? SIN_VARADOS,
    handleDescartarPendientes,
    confirmProps: confirm.confirmProps,
  };
}
