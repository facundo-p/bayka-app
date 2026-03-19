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
  getUserTotalTreeCounts,
  getPendingSyncCounts,
  getTodayTreeCounts,
  getTotalTreeCounts,
} from '../queries/dashboardQueries';

export default function PlantacionesScreen() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();
  const insets = useSafeAreaInsets();
  const userId = useCurrentUserId();

  // Determine role from route prefix (DASH-01 / DASH-02)
  const isAdmin = routePrefix === '(admin)';

  // Role-gated plantation list: admin sees all, tecnico sees only assigned
  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(isAdmin, userId),
    [userId, isAdmin]
  );

  // DASH-03: Total tree count per plantation (all users)
  const { data: totalCounts } = useLiveData(
    () => getTotalTreeCounts()
  );

  // DASH-04: Trees registered by current user that are NOT yet sincronizada
  const { data: unsyncedCounts } = useLiveData(
    () => getUnsyncedTreeCounts(userId),
    [userId]
  );

  // DASH-05: All trees registered by current user (any estado)
  const { data: userTotalCounts } = useLiveData(
    () => getUserTotalTreeCounts(userId),
    [userId]
  );

  // SYNC-07: Pending sync (finalizada SubGroups) count per plantation
  const { data: pendingSyncCounts } = useLiveData(
    () => getPendingSyncCounts()
  );

  // DASH-06: Trees registered by current user today
  const { data: todayCounts } = useLiveData(
    () => getTodayTreeCounts(userId),
    [userId]
  );

  // Build lookup maps
  const totalCountMap = new Map<string, number>();
  if (totalCounts) {
    for (const row of totalCounts) {
      if (row.plantacionId != null) totalCountMap.set(String(row.plantacionId), row.treeCount);
    }
  }

  const unsyncedCountMap = new Map<string, number>();
  if (unsyncedCounts) {
    for (const row of unsyncedCounts) {
      unsyncedCountMap.set(row.plantacionId, row.treeCount);
    }
  }

  const userTotalCountMap = new Map<string, number>();
  if (userTotalCounts) {
    for (const row of userTotalCounts) {
      userTotalCountMap.set(row.plantacionId, row.treeCount);
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
      if (row.plantacionId != null) todayCountMap.set(String(row.plantacionId), row.treeCount);
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
          const todayCount = todayCountMap.get(item.id) ?? 0;
          const totalTreeCount = totalCountMap.get(item.id) ?? 0;
          const unsyncedCount = unsyncedCountMap.get(item.id) ?? 0;
          const pendingSync = pendingSyncMap.get(item.id) ?? 0;

          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/${routePrefix}/plantation/${item.id}` as any)}
            >
              <View style={styles.cardInner}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleArea}>
                    <Text style={styles.cardTitle}>{item.lugar}</Text>
                    <Text style={styles.cardSubtitle}>{item.periodo}</Text>
                  </View>
                  <View style={styles.cardRightArea}>
                    <View style={styles.treeBadgeRow}>
                      {/* DASH-03: Total trees */}
                      <View style={styles.totalTreeBadge}>
                        <TreeIcon size={12} />
                        <Text style={styles.totalTreeBadgeText}>{totalTreeCount} arboles</Text>
                      </View>
                      {/* DASH-04: Unsynced trees */}
                      {unsyncedCount > 0 && (
                        <View style={styles.unsyncedBadge}>
                          <Ionicons name="cloud-upload-outline" size={11} color={colors.secondary} />
                          <Text style={styles.unsyncedBadgeText}>{unsyncedCount} sin sincronizar</Text>
                        </View>
                      )}
                      {/* DASH-06: Today's count */}
                      {todayCount > 0 && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>Hoy: {todayCount}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.estadoChip}>
                      <Text style={styles.estadoLabel}>{item.estado.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                {/* SYNC-07: Pending sync count */}
                {pendingSync > 0 && (
                  <View style={styles.pendingSyncRow}>
                    <Ionicons name="cloud-upload-outline" size={14} color={colors.secondary} />
                    <Text style={styles.pendingSyncText}>
                      {pendingSync} subgrupo{pendingSync > 1 ? 's' : ''} pendiente{pendingSync > 1 ? 's' : ''}
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
    padding: spacing.xxl,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardRightArea: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  treeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  totalTreeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  totalTreeBadgeText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  unsyncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  unsyncedBadgeText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    color: colors.textFaint,
  },
  todayBadge: {
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.lg,
  },
  todayBadgeText: {
    fontSize: fontSize.sm,
    color: colors.info,
    fontWeight: '600',
  },
  estadoChip: {
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-end',
  },
  estadoLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  pendingSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pendingSyncText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: '600',
  },
});
