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
  TextInput,
  ActivityIndicator,
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
  getTotalTreesInPlantation,
  getTodayTreesForUser,
  getUnsyncedTreesForUser,
} from '../queries/plantationDetailQueries';
import { getPlantationEstado, getMaxGlobalId, hasIdsGenerated } from '../queries/adminQueries';
import { generateIds } from '../repositories/PlantationRepository';
import { exportToCSV, exportToExcel } from '../services/ExportService';
import type { SubGroup, SubGroupTipo } from '../repositories/SubGroupRepository';
import SubGroupStateChip from '../components/SubGroupStateChip';
import SubgrupoForm from '../components/SubgrupoForm';
import { useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../theme';
import TreeIcon from '../components/TreeIcon';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { showDoubleConfirmDialog, showConfirmDialog, showInfoDialog } from '../utils/alertHelpers';
import { useSync } from '../hooks/useSync';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import SyncProgressModal from '../components/SyncProgressModal';

export default function PlantationDetailScreen() {
  const { id: plantacionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const routePrefix = useRoutePrefix();
  const userId = useCurrentUserId();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSubGroup, setEditingSubGroup] = useState<SubGroup | null>(null);
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

  // Admin action state
  const [seedModalVisible, setSeedModalVisible] = useState(false);
  const [seedValue, setSeedValue] = useState('');
  const [seedLoading, setSeedLoading] = useState(false);
  const [exportingType, setExportingType] = useState<'csv' | 'xlsx' | null>(null);

  // All queries delegated to plantationDetailQueries.ts — zero inline db access
  const { data: plantationRows } = useLiveData(() => getPlantationLugar(pid), [pid]);
  const { data: subgroupRows } = useLiveData(() => getSubgroupsForPlantation(pid), [pid]);
  const { data: nnCounts } = useLiveData(() => getNNCountsPerSubgroup(pid), [pid]);
  const { data: treeCounts } = useLiveData(() => getTreeCountsPerSubgroup(pid), [pid]);
  const { data: totalTreesData } = useLiveData(() => getTotalTreesInPlantation(pid).then(t => [{ total: t }]), [pid]);
  const { data: todayTreesData } = useLiveData(() => getTodayTreesForUser(pid, userId).then(t => [{ total: t }]), [pid, userId]);
  const { data: unsyncedTreesData } = useLiveData(() => getUnsyncedTreesForUser(pid, userId).then(t => [{ total: t }]), [pid, userId]);

  // Plantation estado — drives finalization lockout and admin actions
  const { data: estadoData } = useLiveData(
    () => getPlantationEstado(pid).then((e) => [{ estado: e ?? '' }]),
    [pid]
  );
  const plantacionEstado = estadoData?.[0]?.estado ?? '';
  const isFinalizada = plantacionEstado === 'finalizada';

  // IDs generated check — gates export vs ID generation buttons (admin only)
  const { data: idsGeneratedData } = useLiveData(
    () => (routePrefix === '(admin)' && isFinalizada ? hasIdsGenerated(pid).then((v) => [{ generated: v }]) : Promise.resolve([{ generated: false }])),
    [pid, routePrefix, isFinalizada]
  );
  const idsGenerated = idsGeneratedData?.[0]?.generated ?? false;

  const unsyncedTrees = unsyncedTreesData?.[0]?.total ?? 0;

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

  const totalTrees = totalTreesData?.[0]?.total ?? 0;
  const todayTrees = todayTreesData?.[0]?.total ?? 0;
  const totalNN = Array.from(nnCountMap.values()).reduce((sum, v) => sum + v, 0);

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
      ? `Este subgrupo tiene ${treeCount} arbol${treeCount > 1 ? 'es' : ''} cargado${treeCount > 1 ? 's' : ''}. Esta accion no se puede deshacer.`
      : 'Esta accion no se puede deshacer.';

    showDoubleConfirmDialog(
      confirm.show,
      'Eliminar subgrupo',
      warningMessage,
      'Confirmar eliminacion',
      'Esta es la confirmacion final. El subgrupo y todos sus arboles seran eliminados permanentemente.',
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

  // ─── Admin action handlers ────────────────────────────────────────────────

  async function handleAdminGenerateIds() {
    try {
      const maxId = await getMaxGlobalId();
      setSeedValue((maxId + 1).toString());
      setSeedModalVisible(true);
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudo obtener el ID sugerido.', 'alert-circle-outline', colors.danger);
    }
  }

  function handleSeedConfirm() {
    const seed = parseInt(seedValue, 10);
    if (isNaN(seed) || seed < 1) {
      showInfoDialog(confirm.show, 'Semilla invalida', 'Ingresa un numero entero mayor a 0.', 'alert-circle-outline', colors.secondary);
      return;
    }
    setSeedModalVisible(false);
    const { show: showConfirmAction } = confirm;
    showConfirmAction({
      icon: 'key-outline',
      iconColor: colors.primary,
      title: 'Generar IDs',
      message: 'Se van a generar IDs para todos los arboles de esta plantacion. Esta accion no se puede deshacer.',
      buttons: [
        { label: 'Cancelar', style: 'cancel', onPress: () => {} },
        {
          label: 'Generar',
          style: 'primary',
          icon: 'key-outline',
          onPress: async () => {
            setSeedLoading(true);
            try {
              await generateIds(pid, seed);
            } catch (e: any) {
              showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron generar los IDs.', 'alert-circle-outline', colors.danger);
            } finally {
              setSeedLoading(false);
            }
          },
        },
      ],
    });
  }

  async function handleAdminExportCsv() {
    const lugar = plantationRows?.[0]?.lugar ?? '';
    setExportingType('csv');
    try {
      await exportToCSV(pid, lugar);
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudo exportar el CSV.', 'alert-circle-outline', colors.danger);
    } finally {
      setExportingType(null);
    }
  }

  async function handleAdminExportExcel() {
    const lugar = plantationRows?.[0]?.lugar ?? '';
    setExportingType('xlsx');
    try {
      await exportToExcel(pid, lugar);
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudo exportar el Excel.', 'alert-circle-outline', colors.danger);
    } finally {
      setExportingType(null);
    }
  }

  function renderSubGroup({ item }: { item: SubGroup }) {
    const nnCount = nnCountMap.get(item.id) ?? 0;
    const treeCount = treeCountMap.get(item.id) ?? 0;
    const isOwner = userId ? item.usuarioCreador === userId : false;
    const showDelete = isOwner && item.estado === 'activa';

    return (
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
          <Text style={styles.treeCountText}>{treeCount}</Text>
          <TreeIcon size={13} />
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
      {/* Fixed stats + N/N banner */}
      <View style={styles.fixedHeader}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalTrees}</Text>
            <Text style={styles.statLabel}>Total arboles</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>{unsyncedTrees}</Text>
            <Text style={styles.statLabel}>Sin sincronizar</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValueToday}>{todayTrees}</Text>
            <Text style={styles.statLabel}>Hoy</Text>
          </View>
        </View>

        {/* Pull button — always visible to download latest data */}
        <Pressable
          style={({ pressed }) => [styles.pullButton, pressed && { opacity: 0.85 }]}
          onPress={startPull}
        >
          <Ionicons name="cloud-download-outline" size={18} color={colors.info} />
          <Text style={styles.pullButtonText}>Actualizar datos</Text>
        </Pressable>

        {/* Sync CTA — visible when there are syncable SubGroups to upload */}
        {syncableCount > 0 && (
          <Pressable
            style={({ pressed }) => [styles.syncButton, pressed && { opacity: 0.85 }]}
            onPress={() => {
              showConfirmDialog(
                confirm.show,
                'Sincronizar',
                `Se van a sincronizar ${syncableCount} subgrupo${syncableCount > 1 ? 's' : ''} finalizado${syncableCount > 1 ? 's' : ''}. Necesitas conexion a internet.`,
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

        {/* N/N sync blocked banner */}
        {blockedByNN > 0 && (
          <View style={styles.nnSyncBlockedRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.secondary} />
            <Text style={styles.nnSyncBlockedText}>
              {blockedByNN} subgrupo{blockedByNN > 1 ? 's' : ''} finalizado{blockedByNN > 1 ? 's' : ''} con N/N pendientes
            </Text>
          </View>
        )}

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

        {/* Finalization lockout banner — shown for all users when finalizada */}
        {isFinalizada && (
          <View style={styles.finalizadaBanner}>
            <Ionicons name="lock-closed" size={16} color={colors.stateFinalizada} />
            <Text style={styles.finalizadaBannerText}>Plantacion finalizada</Text>
          </View>
        )}

        {/* Admin-only action row */}
        {routePrefix === '(admin)' && isFinalizada && (
          <View style={styles.adminActionRow}>
            {!idsGenerated && (
              <Pressable
                style={({ pressed }) => [styles.adminActionBtn, styles.adminActionBtnPrimary, pressed && { opacity: 0.75 }]}
                onPress={handleAdminGenerateIds}
                disabled={seedLoading}
              >
                <Ionicons name="key-outline" size={16} color={colors.white} />
                <Text style={styles.adminActionBtnPrimaryText}>Generar IDs</Text>
              </Pressable>
            )}
            {idsGenerated && (
              <>
                <Pressable
                  style={({ pressed }) => [styles.adminActionBtn, styles.adminActionBtnInfo, pressed && { opacity: 0.75 }]}
                  onPress={handleAdminExportCsv}
                  disabled={exportingType !== null}
                >
                  {exportingType === 'csv' ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={16} color={colors.white} />
                      <Text style={styles.adminActionBtnInfoText}>Exportar CSV</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.adminActionBtn, styles.adminActionBtnInfo, pressed && { opacity: 0.75 }]}
                  onPress={handleAdminExportExcel}
                  disabled={exportingType !== null}
                >
                  {exportingType === 'xlsx' ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="grid-outline" size={16} color={colors.white} />
                      <Text style={styles.adminActionBtnInfoText}>Exportar Excel</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={(subgroupRows ?? []) as SubGroup[]}
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

      {/* Seed dialog for admin ID generation */}
      <Modal
        visible={seedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSeedModalVisible(false)}
      >
        <View style={styles.seedOverlay}>
          <View style={styles.seedCard}>
            <Text style={styles.seedTitle}>Semilla para ID Global</Text>
            <Text style={styles.seedLabel}>Valor inicial del ID Global</Text>
            <TextInput
              style={styles.seedInput}
              value={seedValue}
              onChangeText={setSeedValue}
              keyboardType="number-pad"
              placeholder="Ej: 1001"
              placeholderTextColor={colors.textPlaceholder}
            />
            <View style={styles.seedButtons}>
              <Pressable
                style={({ pressed }) => [styles.seedBtn, styles.seedBtnCancel, pressed && { opacity: 0.7 }]}
                onPress={() => setSeedModalVisible(false)}
              >
                <Text style={styles.seedBtnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.seedBtn, styles.seedBtnConfirm, pressed && { opacity: 0.8 }]}
                onPress={handleSeedConfirm}
              >
                <Text style={styles.seedBtnConfirmText}>Generar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  pullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  pullButtonText: {
    color: colors.info,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.info,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: 'bold',
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
  nnSyncBlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  nnSyncBlockedText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: '500',
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
    opacity: 0.55,
  },
  cardReadOnly: {
    borderLeftColor: colors.borderMuted,
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
    fontSize: fontSize.base,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  cardNameOther: {
    color: colors.textMuted,
    fontWeight: '500',
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
  fabContainer: {
    padding: spacing.xl,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fab: {
    backgroundColor: colors.primary,
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
    fontWeight: 'bold',
  },
  // Edit modal styles
  editModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    fontWeight: 'bold',
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
    fontWeight: '600',
    color: colors.stateFinalizada,
  },
  // ─── Admin action row ───────────────────────────────────────────────────────
  adminActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  adminActionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  adminActionBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  adminActionBtnInfo: {
    backgroundColor: colors.info,
  },
  adminActionBtnInfoText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // ─── Seed dialog ─────────────────────────────────────────────────────────────
  seedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  seedCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing['4xl'],
    gap: spacing.xl,
    width: '100%',
  },
  seedTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  seedLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  seedInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: colors.backgroundAlt,
  },
  seedButtons: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  seedBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    minHeight: 44,
  },
  seedBtnCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seedBtnCancelText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  seedBtnConfirm: {
    backgroundColor: colors.primary,
  },
  seedBtnConfirmText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});
