import { View, Text, FlatList, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useState, useCallback } from 'react';
import { useLiveData, notifyDataChanged } from '../database/liveQuery';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { useNetStatus } from '../hooks/useNetStatus';
import { useProfileData } from '../hooks/useProfileData';
import { checkFreshness } from '../queries/freshnessQueries';
import { pullFromServer, uploadPendingEdits } from '../services/SyncService';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  getPlantationsForRole,
  getSyncedTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
  getTotalTreeCounts,
} from '../queries/dashboardQueries';
import { getUnsyncedSubgroupSummary } from '../queries/catalogQueries';
import { deletePlantationLocally } from '../repositories/PlantationRepository';
import { showConfirmDialog, showDoubleConfirmDialog } from '../utils/alertHelpers';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import PlantationCard from '../components/PlantationCard';
import FilterCards from '../components/FilterCards';
import ScreenHeader from '../components/ScreenHeader';
import ScreenContainer from '../components/ScreenContainer';

export default function PlantacionesScreen() {
  const router = useRouter();
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

  // Check freshness on focus when online
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
      // Push any pending plantation edits before pulling
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

  async function handleDeletePlantation(plantationId: string) {
    const item = plantationList?.find((p) => p.id === plantationId);
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
        async () => { await deletePlantationLocally(plantationId); },
      );
    } else {
      showConfirmDialog(
        confirm.show,
        'Eliminar del dispositivo',
        `La plantacion "${item.lugar}" sera eliminada solo de este celular. Podras volver a descargarla desde el catalogo.`,
        'Eliminar',
        async () => { await deletePlantationLocally(plantationId); },
        { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' },
      );
    }
  }

  // Derive contextual header title
  const headerTitle =
    isAdmin && profile?.organizacionNombre ? profile.organizacionNombre : 'Mis plantaciones';

  // Build lookup maps
  const syncedCountMap = new Map<string, number>();
  if (syncedCounts) for (const row of syncedCounts) syncedCountMap.set(row.plantacionId, row.treeCount);

  const pendingSyncMap = new Map<string, number>();
  if (pendingSyncCounts) for (const row of pendingSyncCounts) pendingSyncMap.set(row.plantacionId, row.pendingCount);

  const todayCountMap = new Map<string, number>();
  if (todayCounts) for (const row of todayCounts) todayCountMap.set(row.plantacionId, row.treeCount);

  const totalCountMap = new Map<string, number>();
  if (totalCounts) for (const row of totalCounts) totalCountMap.set(row.plantacionId, row.treeCount);

  // Count by estado for filter cards
  const estadoCounts = { activa: 0, finalizada: 0 };
  plantationList?.forEach((p: any) => {
    if (estadoCounts[p.estado as keyof typeof estadoCounts] !== undefined) {
      estadoCounts[p.estado as keyof typeof estadoCounts]++;
    }
  });

  const filteredList = plantationList?.filter(
    (p: any) => !activeFilter || p.estado === activeFilter
  ) ?? [];

  const filterConfigs = [
    { key: 'activa', label: 'Activas', count: estadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: estadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

  return (
    <ScreenContainer withTexture>
      <ScreenHeader
        title={headerTitle}
        rightElement={
          <Pressable
            onPress={() => { if (isOnline) router.push(`/${routePrefix}/plantation/catalog` as any); }}
            disabled={!isOnline}
            hitSlop={8}
            style={({ pressed }) => [
              styles.catalogButton,
              !isOnline && styles.catalogButtonDisabled,
              pressed && isOnline && styles.catalogButtonPressed,
            ]}
            accessibilityLabel="Gestionar plantaciones descargadas"
          >
            <Ionicons
              name="download-outline"
              size={18}
              color={isOnline ? colors.white : colors.offline}
            />
          </Pressable>
        }
      />

      {showFreshnessBanner && (
        <View style={styles.freshnessBanner}>
          <Text style={styles.freshnessText}>Hay datos nuevos disponibles</Text>
          <TouchableOpacity
            style={styles.freshnessButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Text style={styles.freshnessButtonText}>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {plantationList && plantationList.length > 0 ? (
        <>
          <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: spacing.xxl, paddingTop: spacing.xl }}>
            <FilterCards
              filters={filterConfigs}
              activeFilter={activeFilter}
              onToggleFilter={(key) => setActiveFilter(prev => prev === key ? null : key)}
            />
          </Animated.View>

          <FlatList
            data={filteredList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
                <PlantationCard
                  lugar={item.lugar}
                  periodo={item.periodo}
                  totalCount={totalCountMap.get(item.id) ?? 0}
                  syncedCount={syncedCountMap.get(item.id) ?? 0}
                  todayCount={todayCountMap.get(item.id) ?? 0}
                  pendingSync={pendingSyncMap.get(item.id) ?? 0}
                  estado={item.estado}
                  onPress={() => router.push(`/${routePrefix}/plantation/${item.id}` as any)}
                  onDelete={() => handleDeletePlantation(item.id)}
                />
              </Animated.View>
            )}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No hay plantaciones disponibles</Text>
          <Text style={styles.emptySubtext}>Las plantaciones asignadas apareceran aqui</Text>
        </View>
      )}
      <ConfirmModal {...confirm.confirmProps} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  freshnessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.info + '30',
  },
  freshnessText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.info,
  },
  freshnessButton: {
    backgroundColor: colors.info,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginLeft: spacing.md,
  },
  freshnessButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  emptySubtext: {
    fontSize: fontSize.base,
    color: colors.textLight,
  },
  listContent: { padding: spacing.xxl, gap: spacing.xl },
  catalogButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.offline,
  },
  catalogButtonPressed: {
    opacity: 0.7,
  },
});
