import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLiveData } from '../database/liveQuery';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../theme';
import TreeIcon from '../components/TreeIcon';
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

  // DASH-03: Synced trees per plantation
  const { data: syncedCounts } = useLiveData(
    () => getSyncedTreeCounts()
  );

  // DASH-04: Unsynced trees (user's, in non-sincronizada subgroups)
  const { data: unsyncedCounts } = useLiveData(
    () => getUnsyncedTreeCounts(userId),
    [userId]
  );

  // SYNC-07: Pending sync SubGroups per plantation
  const { data: pendingSyncCounts } = useLiveData(
    () => getPendingSyncCounts()
  );

  // DASH-06: Today's trees by current user
  const { data: todayCounts } = useLiveData(
    () => getTodayTreeCounts(userId),
    [userId]
  );

  // Build lookup maps
  const syncedCountMap = new Map<string, number>();
  if (syncedCounts) {
    for (const row of syncedCounts) {
      syncedCountMap.set(row.plantacionId, row.treeCount);
    }
  }

  const unsyncedCountMap = new Map<string, number>();
  if (unsyncedCounts) {
    for (const row of unsyncedCounts) {
      unsyncedCountMap.set(row.plantacionId, row.treeCount);
    }
  }

  const pendingSyncMap = new Map<string, number>();
  if (pendingSyncCounts) {
    for (const row of pendingSyncCounts) {
      pendingSyncMap.set(row.plantacionId, row.pendingCount);
    }
  }

  const todayCountMap = new Map<string, number>();
  if (todayCounts) {
    for (const row of todayCounts) {
      todayCountMap.set(row.plantacionId, row.treeCount);
    }
  }

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
        renderItem={({ item }) => {
          const syncedCount = syncedCountMap.get(item.id) ?? 0;
          const unsyncedCount = unsyncedCountMap.get(item.id) ?? 0;
          const todayCount = todayCountMap.get(item.id) ?? 0;
          const pendingSync = pendingSyncMap.get(item.id) ?? 0;

          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/${routePrefix}/plantation/${item.id}` as any)}
            >
              <View style={styles.cardInner}>
                {/* Title row: lugar + periodo */}
                <View style={styles.cardTitleRow}>
                  <View style={styles.cardTitleArea}>
                    <Text style={styles.cardTitle}>{item.lugar}</Text>
                    <Text style={styles.cardSubtitle}>{item.periodo}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>

                {/* Stats row: sincronizados | pendientes | hoy */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <TreeIcon size={11} />
                    <Text style={styles.statValue}>{syncedCount}</Text>
                    <Text style={styles.statLabel}>sincronizados</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="cloud-upload-outline" size={12} color={colors.secondary} />
                    <Text style={[styles.statValue, unsyncedCount > 0 && { color: colors.secondary }]}>{unsyncedCount}</Text>
                    <Text style={styles.statLabel}>pendientes</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="today-outline" size={12} color={colors.info} />
                    <Text style={[styles.statValue, todayCount > 0 && { color: colors.info }]}>{todayCount}</Text>
                    <Text style={styles.statLabel}>hoy</Text>
                  </View>
                </View>

                {/* Pending sync banner */}
                {pendingSync > 0 && (
                  <View style={styles.pendingSyncRow}>
                    <Ionicons name="cloud-upload-outline" size={14} color={colors.secondary} />
                    <Text style={styles.pendingSyncText}>
                      {pendingSync} subgrupo{pendingSync > 1 ? 's' : ''} pendiente{pendingSync > 1 ? 's' : ''} de sincronizar
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  emptyText: {
    fontSize: fontSize.xl,
    color: colors.textSubtle,
  },
  listContent: {
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardInner: {
    padding: spacing.xl,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitleArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    color: colors.textFaint,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.base,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
  pendingSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pendingSyncText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: '600',
  },
});
