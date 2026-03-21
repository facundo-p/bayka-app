import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useLiveData } from '../database/liveQuery';
import { useRouter } from 'expo-router';
import { colors, fontSize, spacing } from '../theme';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
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

  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(isAdmin, userId),
    [userId, isAdmin]
  );

  const { data: syncedCounts } = useLiveData(() => getSyncedTreeCounts());
  const { data: unsyncedCounts } = useLiveData(() => getUnsyncedTreeCounts(userId), [userId]);
  const { data: pendingSyncCounts } = useLiveData(() => getPendingSyncCounts());
  const { data: todayCounts } = useLiveData(() => getTodayTreeCounts(userId), [userId]);

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
        <Text style={styles.headerTitle}>Bayka</Text>
      </View>
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
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSize.title,
    fontWeight: 'bold',
    textAlign: 'center',
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
