import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLiveData } from '../../../src/database/liveQuery';
import { db } from '../../../src/database/client';
import { plantations, trees } from '../../../src/database/schema';
import { eq, desc, and, isNull, count, sql } from 'drizzle-orm';
import { localToday } from '../../../src/utils/dateUtils';
import { canEdit, deleteSubGroup } from '../../../src/repositories/SubGroupRepository';
import { subgroups } from '../../../src/database/schema';
import type { SubGroup } from '../../../src/repositories/SubGroupRepository';
import SubGroupStateChip from '../../../src/components/SubGroupStateChip';
import { supabase, isSupabaseConfigured } from '../../../src/supabase/client';
import { useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../../../src/theme';

export default function PlantationSubGroupList() {
  const { id: plantacionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [userId, setUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load plantation name for header
  const { data: plantationRows } = useLiveData(
    () => db.select({ lugar: plantations.lugar }).from(plantations).where(eq(plantations.id, plantacionId ?? '')),
    [plantacionId]
  );

  // Load subgroups live
  const { data: subgroupRows } = useLiveData(
    () => db.select().from(subgroups)
      .where(eq(subgroups.plantacionId, plantacionId ?? ''))
      .orderBy(desc(subgroups.createdAt)),
    [plantacionId]
  );

  // Load N/N counts per subgroup
  const { data: nnCounts } = useLiveData(
    () => db.select({
      subgrupoId: trees.subgrupoId,
      nnCount: count(),
    })
      .from(trees)
      .where(and(
        isNull(trees.especieId),
        sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId ?? ''})`
      ))
      .groupBy(trees.subgrupoId),
    [plantacionId]
  );

  // Load tree counts per subgroup
  const { data: treeCounts } = useLiveData(
    () => db.select({
      subgrupoId: trees.subgrupoId,
      treeCount: count(),
    })
      .from(trees)
      .where(sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId ?? ''})`)
      .groupBy(trees.subgrupoId),
    [plantacionId]
  );

  // Total trees in plantation
  const { data: totalTreesRow } = useLiveData(
    () => db.select({ total: count() })
      .from(trees)
      .where(sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId ?? ''})`),
    [plantacionId]
  );

  const todayStr = localToday();

  // Today's trees by current user in this plantation
  const { data: todayTreesRow } = useLiveData(
    () => {
      if (!userId) return Promise.resolve([]);
      return db.select({ total: count() })
        .from(trees)
        .where(and(
          sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId ?? ''})`,
          eq(trees.usuarioRegistro, userId),
          sql`${trees.createdAt} LIKE ${todayStr + '%'}`
        ));
    },
    [plantacionId, userId, todayStr]
  );

  // Build maps
  const nnCountMap = new Map<string, number>();
  if (nnCounts) {
    for (const row of nnCounts) {
      nnCountMap.set(row.subgrupoId, row.nnCount);
    }
  }

  const treeCountMap = new Map<string, number>();
  if (treeCounts) {
    for (const row of treeCounts) {
      treeCountMap.set(row.subgrupoId, row.treeCount);
    }
  }

  const totalTrees = totalTreesRow?.[0]?.total ?? 0;
  const todayTrees = todayTreesRow?.[0]?.total ?? 0;
  const totalNN = Array.from(nnCountMap.values()).reduce((sum, v) => sum + v, 0);

  // Set header title
  useEffect(() => {
    const lugar = plantationRows?.[0]?.lugar;
    if (lugar) {
      navigation.setOptions({ title: lugar });
    }
  }, [plantationRows, navigation]);

  // Resolve userId
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  function handleSubGroupPress(subgroup: SubGroup) {
    if (subgroup.estado !== 'activa') return;
    router.push(
      `/(tecnico)/plantation/subgroup/${subgroup.id}?plantacionId=${plantacionId}&subgrupoCodigo=${subgroup.codigo}&subgrupoNombre=${encodeURIComponent(subgroup.nombre)}`
    );
  }

  function handleDeleteSubGroup(subgroup: SubGroup) {
    const treeCount = treeCountMap.get(subgroup.id) ?? 0;
    const warningMessage = treeCount > 0
      ? `Este subgrupo tiene ${treeCount} arbol${treeCount > 1 ? 'es' : ''} cargado${treeCount > 1 ? 's' : ''}. Esta accion no se puede deshacer.`
      : 'Esta accion no se puede deshacer.';

    Alert.alert(
      'Eliminar subgrupo',
      warningMessage,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar eliminacion',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Estas seguro?',
              'Esta es la confirmacion final. El subgrupo y todos sus arboles seran eliminados permanentemente.',
              [
                { text: 'No, cancelar', style: 'cancel' },
                {
                  text: 'Si, eliminar',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingId(subgroup.id);
                    try {
                      await deleteSubGroup(subgroup.id);
                    } finally {
                      setDeletingId(null);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  function handleResolveAllNN() {
    router.push(`/(tecnico)/plantation/subgroup/nn-resolution?plantacionId=${plantacionId}`);
  }

  function renderSubGroup({ item }: { item: SubGroup }) {
    const nnCount = nnCountMap.get(item.id) ?? 0;
    const treeCount = treeCountMap.get(item.id) ?? 0;
    const isOwner = userId ? item.usuarioCreador === userId : false;
    const showDelete = isOwner && item.estado === 'activa';
    const tipoLabel = item.tipo === 'linea' ? 'L' : 'P';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          !isOwner && styles.cardOtherUser,
          item.estado !== 'activa' && styles.cardReadOnly,
          item.estado === 'activa' && pressed && styles.cardPressed,
        ]}
        onPress={() => handleSubGroupPress(item)}
        disabled={item.estado !== 'activa'}
      >
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>{item.nombre}</Text>
          <Text style={styles.cardCode}>{item.codigo}</Text>
          <Text style={styles.cardTipo}>{tipoLabel}</Text>
          <Text style={styles.treeCountText}>{treeCount}</Text>
          {nnCount > 0 && (
            <View style={styles.nnBadge}>
              <Text style={styles.nnBadgeText}>{nnCount}</Text>
            </View>
          )}
          <SubGroupStateChip estado={item.estado} />
          {showDelete && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteSubGroup(item);
              }}
              hitSlop={8}
              style={styles.deleteCardButton}
              disabled={deletingId === item.id}
            >
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={(subgroupRows ?? []) as SubGroup[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Stats summary */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalTrees}</Text>
                <Text style={styles.statLabel}>Total arboles</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValueToday}>{todayTrees}</Text>
                <Text style={styles.statLabel}>Hoy</Text>
              </View>
            </View>

            {/* Resolve all N/N button */}
            {totalNN > 0 && (
              <Pressable
                style={({ pressed }) => [styles.resolveNNBanner, pressed && { opacity: 0.8 }]}
                onPress={handleResolveAllNN}
              >
                <Ionicons name="alert-circle-outline" size={18} color={colors.secondary} />
                <Text style={styles.resolveNNText}>
                  Resolver {totalNN} N/N pendiente{totalNN > 1 ? 's' : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
              </Pressable>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay subgrupos aun</Text>
            <Text style={styles.emptySubtext}>Toca "+" para crear el primero</Text>
          </View>
        }
        renderItem={renderSubGroup}
      />
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push(`/(tecnico)/plantation/nuevo-subgrupo?plantacionId=${plantacionId}`)}
      >
        <Text style={styles.fabLabel}>+ Nuevo subgrupo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.xxl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.sm,
    gap: spacing.xxl,
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statValueToday: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.info,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  resolveNNBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  resolveNNText: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.secondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  cardOtherUser: {
    backgroundColor: colors.otherUserBg,
    borderLeftColor: colors.otherUserBorder,
  },
  cardReadOnly: {
    borderLeftColor: colors.borderMuted,
    opacity: 0.7,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardName: {
    fontSize: fontSize.base,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  cardCode: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  cardTipo: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontWeight: '500',
  },
  treeCountText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  deleteCardButton: {
    padding: 2,
  },
  nnBadge: {
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  nnBadgeText: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: spacing['4xl'],
    right: spacing.xxl,
    left: spacing.xxl,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabPressed: {
    opacity: 0.85,
  },
  fabLabel: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
});
