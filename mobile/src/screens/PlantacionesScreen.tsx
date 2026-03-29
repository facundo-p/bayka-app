import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useCallback } from 'react';
import { useLiveData, notifyDataChanged } from '../database/liveQuery';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { colors, fontSize, spacing, borderRadius } from '../theme';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { useNetStatus } from '../hooks/useNetStatus';
import { useProfileData } from '../hooks/useProfileData';
import { checkFreshness } from '../queries/freshnessQueries';
import { pullFromServer } from '../services/SyncService';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getPlantationsForRole,
  getUnsyncedTreeCounts,
  getSyncedTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
} from '../queries/dashboardQueries';
import PlantationCard from '../components/PlantationCard';

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

  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(isAdmin, userId),
    [userId, isAdmin]
  );

  const { data: syncedCounts } = useLiveData(() => getSyncedTreeCounts());
  const { data: unsyncedCounts } = useLiveData(() => getUnsyncedTreeCounts(userId), [userId]);
  const { data: pendingSyncCounts } = useLiveData(() => getPendingSyncCounts());
  const { data: todayCounts } = useLiveData(() => getTodayTreeCounts(userId), [userId]);

  // Check freshness on focus when online
  useFocusEffect(
    useCallback(() => {
      if (!isOnline || !plantationList?.length) return;
      checkFreshness(plantationList.map((p) => p.id)).then((isFresh) => {
        if (isFresh) setShowFreshnessBanner(true);
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

  const unsyncedCountMap = new Map<string, number>();
  if (unsyncedCounts) for (const row of unsyncedCounts) unsyncedCountMap.set(row.plantacionId, row.treeCount);

  const pendingSyncMap = new Map<string, number>();
  if (pendingSyncCounts) for (const row of pendingSyncCounts) pendingSyncMap.set(row.plantacionId, row.pendingCount);

  const todayCountMap = new Map<string, number>();
  if (todayCounts) for (const row of todayCounts) todayCountMap.set(row.plantacionId, row.treeCount);

  if (!plantationList || plantationList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay plantaciones disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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

      <FlatList
        data={plantationList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PlantationCard
            lugar={item.lugar}
            periodo={item.periodo}
            syncedCount={syncedCountMap.get(item.id) ?? 0}
            unsyncedCount={unsyncedCountMap.get(item.id) ?? 0}
            todayCount={todayCountMap.get(item.id) ?? 0}
            pendingSync={pendingSyncMap.get(item.id) ?? 0}
            onPress={() => router.push(`/${routePrefix}/plantation/${item.id}` as any)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSize.title,
    fontWeight: 'bold',
  },
  freshnessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    borderRadius: borderRadius.md,
    marginLeft: spacing.md,
  },
  freshnessButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyText: { fontSize: fontSize.xl, color: colors.textSubtle },
  listContent: { padding: spacing.xxl, gap: spacing.xl },
});
