import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLiveData } from '../database/liveQuery';
import { useRouter } from 'expo-router';
import { db } from '../database/client';
import { plantations, trees, subgroups } from '../database/schema';
import { desc, eq, and, sql, count } from 'drizzle-orm';
import { localToday } from '../utils/dateUtils';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../theme';
import TreeIcon from '../components/TreeIcon';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrentUserId } from '../hooks/useCurrentUserId';

export default function PlantacionesScreen() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();
  const insets = useSafeAreaInsets();
  const userId = useCurrentUserId();

  const { data: plantationList } = useLiveData(
    () => db.select().from(plantations).orderBy(desc(plantations.createdAt))
  );

  const todayStr = localToday();

  // Trees registered today by current user, grouped by plantation (via subgroup)
  const { data: todayCounts } = useLiveData(
    () => {
      if (!userId) return Promise.resolve([]);
      return db.select({
        plantacionId: subgroups.plantacionId,
        treeCount: count(),
      })
        .from(trees)
        .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
        .where(and(
          eq(trees.usuarioRegistro, userId),
          sql`${trees.createdAt} LIKE ${todayStr + '%'}`
        ))
        .groupBy(subgroups.plantacionId);
    },
    [userId, todayStr]
  );

  // Total tree count per plantation (via subgroup join)
  const { data: totalCounts } = useLiveData(
    () => db.select({
      plantacionId: subgroups.plantacionId,
      treeCount: count(),
    })
      .from(trees)
      .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
      .groupBy(subgroups.plantacionId)
  );

  const todayCountMap = new Map<string, number>();
  if (todayCounts) {
    for (const row of todayCounts) {
      todayCountMap.set(row.plantacionId, row.treeCount);
    }
  }

  const totalCountMap = new Map<string, number>();
  if (totalCounts) {
    for (const row of totalCounts) {
      totalCountMap.set(row.plantacionId, row.treeCount);
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
                      <View style={styles.totalTreeBadge}>
                        <TreeIcon size={12} />
                        <Text style={styles.totalTreeBadgeText}>{totalTreeCount} árboles</Text>
                      </View>
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
});
