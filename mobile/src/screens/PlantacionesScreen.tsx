import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useCallback } from 'react';
import { useLiveData, notifyDataChanged } from '../database/liveQuery';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { useNetStatus } from '../hooks/useNetStatus';
import { useProfileData } from '../hooks/useProfileData';
import { checkFreshness } from '../queries/freshnessQueries';
import { pullFromServer } from '../services/SyncService';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  getPlantationsForRole,
  getSyncedTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
  getTotalTreeCounts,
} from '../queries/dashboardQueries';
import PlantationCard from '../components/PlantationCard';
import FilterCards from '../components/FilterCards';

export default function PlantacionesScreen() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();
  const insets = useSafeAreaInsets();
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

  if (!plantationList || plantationList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No hay plantaciones disponibles</Text>
        <Text style={styles.emptySubtext}>Las plantaciones asignadas apareceran aqui</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Subtle gradient background */}
      <View style={styles.gradientBg} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>
        <Ionicons
          name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
          size={20}
          color={isOnline ? colors.online : colors.offline}
        />
      </View>

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
            />
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradientBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: colors.stateActiva,
    opacity: 0.12,
  },
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
  },
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
    backgroundColor: colors.background,
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
});
