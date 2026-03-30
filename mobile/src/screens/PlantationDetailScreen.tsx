import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLiveData } from '../database/liveQuery';
import {
  deleteSubGroup,
  updateSubGroup,
  updateSubGroupCode,
} from '../repositories/SubGroupRepository';
import {
  getPlantationLugar,
  getSubgroupsForPlantation,
  getNNCountsPerSubgroup,
  getTreeCountsPerSubgroup,
} from '../queries/plantationDetailQueries';
import { getPlantationEstado } from '../queries/adminQueries';
import type { SubGroup, SubGroupTipo } from '../repositories/SubGroupRepository';
import SubGroupStateChip from '../components/SubGroupStateChip';
import SubgrupoForm from '../components/SubgrupoForm';
import { useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import TreeIcon from '../components/TreeIcon';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { showDoubleConfirmDialog, showConfirmDialog } from '../utils/alertHelpers';
import { useSync } from '../hooks/useSync';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { useNetStatus } from '../hooks/useNetStatus';
import SyncProgressModal from '../components/SyncProgressModal';
import FilterCards from '../components/FilterCards';

export default function PlantationDetailScreen() {
  const { id: plantacionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const routePrefix = useRoutePrefix();
  const userId = useCurrentUserId();
  const { isOnline } = useNetStatus();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSubGroup, setEditingSubGroup] = useState<SubGroup | null>(null);
  const [subgroupFilter, setSubgroupFilter] = useState<string | null>(null);
  const confirm = useConfirm();

  // Pending sync count for this plantation (finalizada SubGroups)
  const { syncableCount, blockedByNN } = usePendingSyncCount(plantacionId);

  // Sync hook — drives the SyncProgressModal
  const {
    state: syncState,
    progress,
    results,
    startSync,
    startPull,
    pullSuccess,
    reset: resetSync,
    successCount,
    failureCount,
  } = useSync(plantacionId ?? '');

  const pid = plantacionId ?? '';

  // All queries delegated to plantationDetailQueries.ts — zero inline db access
  const { data: plantationRows } = useLiveData(() => getPlantationLugar(pid), [pid]);
  const { data: subgroupRows } = useLiveData(() => getSubgroupsForPlantation(pid), [pid]);
  const { data: nnCounts } = useLiveData(() => getNNCountsPerSubgroup(pid), [pid]);
  const { data: treeCounts } = useLiveData(() => getTreeCountsPerSubgroup(pid), [pid]);

  // Plantation estado — drives finalization lockout and admin actions
  const { data: estadoData } = useLiveData(
    () => getPlantationEstado(pid).then((e) => [{ estado: e ?? '' }]),
    [pid]
  );
  const plantacionEstado = estadoData?.[0]?.estado ?? '';
  const isFinalizada = plantacionEstado === 'finalizada';

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

  const totalNN = Array.from(nnCountMap.values()).reduce((sum, v) => sum + v, 0);

  // Subgroup estado counts for filter cards
  const subgroupEstadoCounts = { activa: 0, finalizada: 0, sincronizada: 0 };
  (subgroupRows ?? []).forEach((sg: any) => {
    if (subgroupEstadoCounts[sg.estado as keyof typeof subgroupEstadoCounts] !== undefined) {
      subgroupEstadoCounts[sg.estado as keyof typeof subgroupEstadoCounts]++;
    }
  });

  const filteredSubgroups = ((subgroupRows ?? []) as SubGroup[]).filter(
    sg => !subgroupFilter || sg.estado === subgroupFilter
  );

  const subgroupFilterConfigs = [
    { key: 'activa', label: 'Activas', count: subgroupEstadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: subgroupEstadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
    { key: 'sincronizada', label: 'Sincronizadas', count: subgroupEstadoCounts.sincronizada, color: colors.stateSincronizada, icon: 'checkmark-circle-outline' },
  ];

  // Set header title
  useEffect(() => {
    const lugar = plantationRows?.[0]?.lugar;
    if (lugar) {
      navigation.setOptions({ title: lugar, headerTitleAlign: 'center' });
    }
  }, [plantationRows, navigation]);

  function handleSubGroupPress(subgroup: SubGroup) {
    router.push(
      `/${routePrefix}/plantation/subgroup/${subgroup.id}?plantacionId=${plantacionId}&subgrupoCodigo=${subgroup.codigo}&subgrupoNombre=${encodeURIComponent(subgroup.nombre)}` as any
    );
  }

  function handleLongPress(subgroup: SubGroup) {
    const isOwner = userId ? subgroup.usuarioCreador === userId : false;
    if (!isOwner || subgroup.estado !== 'activa') return;
    setEditingSubGroup(subgroup);
  }

  function handleDeleteSubGroup(subgroup: SubGroup) {
    const treeCount = treeCountMap.get(subgroup.id) ?? 0;
    const warningMessage = treeCount > 0
      ? `Este subgrupo tiene ${treeCount} árbol${treeCount > 1 ? 'es' : ''} cargado${treeCount > 1 ? 's' : ''}. Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.';

    showDoubleConfirmDialog(
      confirm.show,
      'Eliminar subgrupo',
      warningMessage,
      'Confirmar eliminación',
      'Esta es la confirmación final. El subgrupo y todos sus árboles serán eliminados permanentemente.',
      async () => {
        setDeletingId(subgroup.id);
        try {
          await deleteSubGroup(subgroup.id);
        } finally {
          setDeletingId(null);
        }
      },
    );
  }

  function handleResolveAllNN() {
    router.push(`/${routePrefix}/plantation/subgroup/nn-resolution?plantacionId=${plantacionId}` as any);
  }

  function renderSubGroup({ item, index }: { item: SubGroup; index: number }) {
    const nnCount = nnCountMap.get(item.id) ?? 0;
    const treeCount = treeCountMap.get(item.id) ?? 0;
    const isOwner = userId ? item.usuarioCreador === userId : false;
    const showDelete = isOwner && item.estado === 'activa';

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(250)}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          !isOwner && styles.cardOtherUser,
          item.estado !== 'activa' && styles.cardReadOnly,
          pressed && styles.cardPressed,
        ]}
        onPress={() => handleSubGroupPress(item)}
        onLongPress={() => handleLongPress(item)}
      >
        <View style={styles.cardRow}>
          <Text style={[styles.cardName, !isOwner && styles.cardNameOther]} numberOfLines={1}>{item.nombre}</Text>
          {nnCount > 0 && (
            <View style={styles.nnBadge}>
              <Text style={styles.nnBadgeText}>{nnCount} N/N</Text>
            </View>
          )}
          <SubGroupStateChip estado={item.estado} />
          <Text style={styles.treeCountText}>{treeCount}</Text>
          <TreeIcon size={13} />
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
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed header: buttons + N/N banner */}
      <View style={styles.fixedHeader}>

        {/* Pull + Sync buttons — only when online */}
        {isOnline && (
          <>
            <Pressable
              style={({ pressed }) => [styles.pullButton, pressed && { opacity: 0.85 }]}
              onPress={startPull}
            >
              <Ionicons name="cloud-download-outline" size={18} color={colors.statSynced} />
              <Text style={styles.pullButtonText}>Actualizar datos</Text>
            </Pressable>

            {syncableCount > 0 && (
              <Pressable
                style={({ pressed }) => [styles.syncButton, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  showConfirmDialog(
                    confirm.show,
                    'Sincronizar',
                    `Se van a sincronizar ${syncableCount} subgrupo${syncableCount > 1 ? 's' : ''} finalizado${syncableCount > 1 ? 's' : ''}. Necesitas conexión a internet.`,
                    'Sincronizar',
                    startSync,
                    { icon: 'cloud-upload-outline', iconColor: colors.info },
                  );
                }}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
                <Text style={styles.syncButtonText}>
                  Sincronizar {syncableCount} subgrupo{syncableCount > 1 ? 's' : ''}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {/* Consolidated N/N banner */}
        {(totalNN > 0 || blockedByNN > 0) && (
          <Pressable
            style={({ pressed }) => [styles.resolveNNBanner, totalNN > 0 && pressed && { opacity: 0.8 }]}
            onPress={totalNN > 0 ? handleResolveAllNN : undefined}
            disabled={totalNN === 0}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.secondary} />
            <View style={styles.nnBannerContent}>
              {totalNN > 0 && (
                <Text style={styles.resolveNNText}>
                  Resolver {totalNN} N/N pendiente{totalNN > 1 ? 's' : ''}
                </Text>
              )}
              {blockedByNN > 0 && (
                <Text style={styles.nnSyncBlockedText}>
                  {blockedByNN} subgrupo{blockedByNN > 1 ? 's' : ''} finalizado{blockedByNN > 1 ? 's' : ''} con N/N pendientes
                </Text>
              )}
            </View>
            {totalNN > 0 && (
              <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
            )}
          </Pressable>
        )}

        {/* Finalization lockout banner — shown for all users when finalizada */}
        {isFinalizada && (
          <View style={styles.finalizadaBanner}>
            <Ionicons name="lock-closed" size={16} color={colors.stateFinalizada} />
            <Text style={styles.finalizadaBannerText}>Plantacion finalizada</Text>
          </View>
        )}


        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ paddingTop: spacing.md }}>
          <FilterCards
            filters={subgroupFilterConfigs}
            activeFilter={subgroupFilter}
            onToggleFilter={(key) => setSubgroupFilter(prev => prev === key ? null : key)}
          />
        </Animated.View>
      </View>

      <FlatList
        data={filteredSubgroups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay subgrupos aun</Text>
            <Text style={styles.emptySubtext}>Toca "+" para crear el primero</Text>
          </View>
        }
        renderItem={renderSubGroup}
      />
      {/* FAB — hidden when plantation is finalizada (Pitfall 8) */}
      {!isFinalizada && (
        <View style={styles.fabContainer}>
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            onPress={() => router.push(`/${routePrefix}/plantation/nuevo-subgrupo?plantacionId=${plantacionId}` as any)}
          >
            <Text style={styles.fabLabel}>+ Nuevo subgrupo</Text>
          </Pressable>
        </View>
      )}

      {/* Sync progress modal — shown during and after sync */}
      <SyncProgressModal
        state={syncState}
        progress={progress}
        results={results}
        successCount={successCount}
        failureCount={failureCount}
        pullSuccess={pullSuccess}
        onDismiss={resetSync}
      />

      <ConfirmModal {...confirm.confirmProps} />

      {/* Edit subgroup modal */}
      <Modal
        visible={!!editingSubGroup}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingSubGroup(null)}
      >
        <KeyboardAvoidingView
          style={styles.editModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.editModalDismiss} onPress={() => setEditingSubGroup(null)} />
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Editar subgrupo</Text>
            {editingSubGroup && (
              <SubgrupoForm
                mode="edit"
                plantacionId={plantacionId ?? ''}
                initialValues={{
                  nombre: editingSubGroup.nombre,
                  codigo: editingSubGroup.codigo,
                  tipo: editingSubGroup.tipo as SubGroupTipo,
                }}
                onSubmit={async (values) => {
                  const result = await updateSubGroup(editingSubGroup.id, values);
                  if (result.success && values.codigo !== editingSubGroup.codigo) {
                    await updateSubGroupCode(editingSubGroup.id, values.codigo, editingSubGroup.codigo);
                  }
                  if (result.success) {
                    setEditingSubGroup(null);
                  }
                  return result;
                }}
                onCancel={() => setEditingSubGroup(null)}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fixedHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  pullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.statSynced + '15',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  pullButtonText: {
    color: colors.statSynced,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.statSynced,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
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
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.secondary,
  },
  nnBannerContent: {
    flex: 1,
  },
  nnSyncBlockedText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontFamily: fonts.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOtherUser: {
    backgroundColor: colors.otherUserBg,
    opacity: 0.55,
  },
  cardReadOnly: {
    opacity: 0.75,
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
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
    color: colors.text,
    flex: 1,
  },
  cardNameOther: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  cardTipo: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontFamily: fonts.medium,
  },
  treeCountText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.semiBold,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
  },
  emptySubtext: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  fabContainer: {
    padding: spacing.xl,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fab: {
    backgroundColor: colors.headerBg,
    paddingVertical: spacing.xl,
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
    fontFamily: fonts.bold,
  },
  // Edit modal styles
  editModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  editModalDismiss: {
    flex: 1,
  },
  editModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.round,
    borderTopRightRadius: borderRadius.round,
    padding: spacing.xxxl,
    paddingBottom: spacing['6xl'],
  },
  editModalTitle: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: spacing.xxxl,
  },
  // ─── Finalization lockout banner ────────────────────────────────────────────
  finalizadaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stateFinalizada + '66',
  },
  finalizadaBannerText: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.stateFinalizada,
  },
});
