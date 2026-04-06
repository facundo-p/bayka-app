import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useTrees } from '../hooks/useTrees';
import { usePlantationSpecies } from '../hooks/usePlantationSpecies';
import {
  insertTree,
  deleteLastTree,
  reverseTreeOrder,
  updateTreePhoto,
  deleteTreeAndRecalculate,
} from '../repositories/TreeRepository';
import {
  finalizeSubGroup,
  canEdit,
  deleteSubGroup,
  reactivateSubGroup,
} from '../repositories/SubGroupRepository';
import { launchCamera, launchGallery } from '../services/PhotoService';
import { usePhotoPicker } from '../hooks/usePhotoPicker';
import { useLiveData } from '../database/liveQuery';
import { getSubgroupById } from '../queries/plantationDetailQueries';
import SpeciesButtonGrid from '../components/SpeciesButtonGrid';
import CustomHeader from '../components/CustomHeader';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import TreeIcon from '../components/TreeIcon';
import type { SubGroupEstado } from '../repositories/SubGroupRepository';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { showConfirmDialog, showDoubleConfirmDialog, showInfoDialog } from '../utils/alertHelpers';
import { getSpeciesCode, getSpeciesName } from '../utils/speciesHelpers';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import SpeciesReorderList, { ReorderItem } from '../components/SpeciesReorderList';
import { saveUserSpeciesOrder } from '../repositories/UserSpeciesOrderRepository';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHIP_GAP = 6; // spacing.sm
const CHIP_PADDING = 8; // spacing.md (horizontal padding of lastThreeSection)
const CHIP_WIDTH = (SCREEN_WIDTH - CHIP_PADDING * 2 - CHIP_GAP * 2) / 3;

export default function TreeRegistrationScreen() {
  const { id: subgrupoId } = useLocalSearchParams<{
    id: string;
    plantacionId: string;
    subgrupoCodigo: string;
    subgrupoNombre: string;
  }>();
  const { plantacionId, subgrupoCodigo, subgrupoNombre } = useLocalSearchParams<{
    plantacionId: string;
    subgrupoCodigo: string;
    subgrupoNombre: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();

  const userId = useCurrentUserId() ?? '';
  const confirm = useConfirm();
  const { pickPhoto } = usePhotoPicker(confirm.show, launchCamera, launchGallery);
  const [finalizing, setFinalizing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; treeId: string } | null>(null);
  const [showTreeList, setShowTreeList] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);

  const { allTrees, lastThree, totalCount, unresolvedNN } = useTrees(subgrupoId ?? '');
  const { species, loading: speciesLoading, refreshSpecies } = usePlantationSpecies(plantacionId ?? '');

  // Load subgroup data for ownership check
  const { data: subgroupRows } = useLiveData(
    () => getSubgroupById(subgrupoId ?? ''),
    [subgrupoId]
  );
  const subgroup = subgroupRows?.[0] ?? null;
  const subgroupEstado = (subgroup?.estado ?? 'activa') as SubGroupEstado;
  const isCreator = subgroup && userId ? subgroup.usuarioCreador === userId : false;
  const isOwner = subgroup && userId
    ? canEdit({ usuarioCreador: subgroup.usuarioCreador, estado: subgroupEstado }, userId)
    : false;
  // Read-only when not owner OR when subgroup is not activa.
  // Both subgroup AND userId must be loaded before we trust the isReadOnly decision
  // (userId loads async — if subgroup loads first, isOwner would be false → flash of tree list).
  const dataLoaded = subgroup !== null && userId !== '';
  const isReadOnly = dataLoaded ? (!isOwner || subgroupEstado !== 'activa') : false;
  const canReactivate = isCreator && subgroupEstado === 'finalizada';

  // Hide default header, use custom one
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  async function handleSpeciesPress(especieId: string, especieCodigo: string) {
    if (isReadOnly || !userId) return;
    await insertTree({
      subgrupoId: subgrupoId ?? '',
      subgrupoCodigo: subgrupoCodigo ?? '',
      especieId,
      especieCodigo,
      userId,
    });
  }

  async function handleNNPress() {
    if (isReadOnly || !userId) return;
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    await insertTree({
      subgrupoId: subgrupoId ?? '',
      subgrupoCodigo: subgrupoCodigo ?? '',
      especieId: null,
      especieCodigo: 'NN',
      fotoUrl: photoUri,
      userId,
    });
  }

  async function handleUndo() {
    if (isReadOnly) return;
    await deleteLastTree(subgrupoId ?? '');
  }

  async function handleAddPhotoToTree(treeId: string) {
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    await updateTreePhoto(treeId, photoUri);
  }

  // ─── Config modal handlers ──────────────────────────────────────────────
  const [reorderItems, setReorderItems] = useState<ReorderItem[]>([]);

  function handleOpenConfig() {
    setShowConfigModal(true);
  }

  function handleReverseOrder() {
    setShowConfigModal(false);
    if (isReadOnly) return;
    showConfirmDialog(
      confirm.show,
      'Invertir Orden',
      'Invertir el orden de los árboles? Se recalcularán todas las posiciones y códigos.',
      'Invertir',
      async () => {
        setReversing(true);
        try {
          await reverseTreeOrder(subgrupoId ?? '', subgrupoCodigo ?? '');
        } finally {
          setReversing(false);
        }
      },
      { icon: 'swap-vertical-outline' },
    );
  }

  function handleOpenReorder() {
    setShowConfigModal(false);
    // Initialize reorder list from current species order
    setReorderItems(
      species.map((s, i) => ({
        especieId: s.especieId,
        nombre: s.nombre,
        codigo: s.codigo,
        ordenVisual: i,
      }))
    );
    setShowReorderModal(true);
  }

  async function handleSaveReorder() {
    if (!userId || !plantacionId) return;
    await saveUserSpeciesOrder(
      userId,
      plantacionId,
      reorderItems.map((item) => ({ especieId: item.especieId, ordenVisual: item.ordenVisual }))
    );
    setShowReorderModal(false);
    refreshSpecies();
  }

  function handleFinalizar() {
    if (isReadOnly) return;

    if (totalCount === 0) {
      showInfoDialog(confirm.show, 'No se puede finalizar', 'No hay árboles cargados.', 'information-circle-outline', colors.secondary);
      return;
    }

    const nnWarning = unresolvedNN > 0
      ? ` Hay ${unresolvedNN} árbol${unresolvedNN > 1 ? 'es' : ''} N/N sin resolver.
      (deberan resolverse antes de sincronizar).`
      : '';

    showConfirmDialog(
      confirm.show,
      'Finalizar subgrupo',
      `Confirmar finalización? 
      ${nnWarning}`,
      'Finalizar',
      async () => {
        setFinalizing(true);
        try {
          await finalizeSubGroup(subgrupoId ?? '');
          router.back();
        } finally {
          setFinalizing(false);
        }
      },
      { icon: 'checkmark-circle-outline', style: 'primary' },
    );
  }

  function handleDeleteSubGroup() {
    if (isReadOnly) return;

    const warningMessage = totalCount > 0
      ? `Este subgrupo tiene ${totalCount} árbol${totalCount > 1 ? 'es' : ''} cargado${totalCount > 1 ? 's' : ''}. Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.';

    showDoubleConfirmDialog(
      confirm.show,
      'Eliminar subgrupo',
      warningMessage,
      'Confirmar eliminación',
      'Esta es la confirmación final. El subgrupo y todos sus árboles serán eliminados permanentemente.',
      async () => {
        setDeleting(true);
        try {
          await deleteSubGroup(subgrupoId ?? '');
          router.back();
        } finally {
          setDeleting(false);
        }
      },
    );
  }

  async function handleReactivate() {
    if (!subgrupoId || !canReactivate) return;
    showConfirmDialog(
      confirm.show,
      'Reactivar subgrupo',
      'Cambiar el estado del subgrupo a activa? Podrás registrar más árboles.',
      'Reactivar',
      async () => {
        await reactivateSubGroup(subgrupoId);
      },
      { icon: 'refresh-outline' },
    );
  }

  function handleDeleteTree(treeId: string, posicion: number) {
    if (isReadOnly) return;
    showConfirmDialog(
      confirm.show,
      'Eliminar árbol',
      `Eliminar el árbol en posición ${posicion}? Las posiciones se recalcularán automáticamente.`,
      'Eliminar',
      async () => {
        setDeletingTreeId(treeId);
        try {
          await deleteTreeAndRecalculate(treeId, subgrupoId ?? '', subgrupoCodigo ?? '');
        } finally {
          setDeletingTreeId(null);
        }
      },
      { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' },
    );
  }

  // Sort trees ascending by position for the full list
  const sortedTrees = [...allTrees].sort((a, b) => a.posicion - b.posicion);

  return (
    <View style={styles.container}>
      {/* Custom header */}
      <CustomHeader
        title={subgrupoNombre ?? subgrupoCodigo ?? ''}
        subtitle={subgroup ? `${subgroup.codigo} · ${subgroup.tipo === 'linea' ? 'Línea' : 'Parcela'}` : undefined}
        onBack={() => router.back()}
        rightElement={
          <View style={styles.headerRight}>
            <Text style={styles.headerCount}>{totalCount}</Text>
            <TreeIcon size={14} />
            {unresolvedNN > 0 && (
              <View style={styles.headerNNBadge}>
                <Text style={styles.headerNNText}>{unresolvedNN} N/N</Text>
              </View>
            )}
          </View>
        }
      />

      {/* View all trees button — always visible in edit mode to reserve space */}
      {dataLoaded && !isReadOnly && (
        <Pressable
          style={({ pressed }) => [styles.viewAllRow, pressed && totalCount > 0 && { opacity: 0.7 }]}
          onPress={() => totalCount > 0 && setShowTreeList(true)}
          disabled={totalCount === 0}
        >
          <Ionicons name="list-outline" size={16} color={totalCount > 0 ? colors.primary : colors.textLight} />
          <Text style={[styles.viewAllText, totalCount === 0 && { color: colors.textLight }]}>
            {totalCount > 0 ? 'Ver todos los árboles' : 'Sin árboles cargados'}
          </Text>
          {totalCount > 0 && <Ionicons name="chevron-forward" size={14} color={colors.primary} />}
        </Pressable>
      )}

      {/* Last 3 trees — only in edit mode */}
      {dataLoaded && !isReadOnly && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.lastThreeSection}>
          <Text style={styles.lastThreeLabel}>Últimos ingresados</Text>
          <View style={styles.lastThreeRow}>
            {[0, 1, 2].map((slotIndex) => {
              const reversedTrees = [...lastThree].reverse();
              const tree = reversedTrees[slotIndex];
              if (!tree) {
                return <View key={`empty-${slotIndex}`} style={[styles.treeChip, styles.treeChipEmpty]} />;
              }
              const isLast = slotIndex === lastThree.length - 1;
              const code = getSpeciesCode(tree);
              return (
                <View key={tree.id} style={[styles.treeChip, isLast && styles.treeChipLast]}>
                  <Text style={[styles.treeChipText, isLast && styles.treeChipTextLast]}>
                    {tree.posicion} {code}
                  </Text>
                  {isLast && (
                    <Pressable onPress={handleUndo} hitSlop={8} style={styles.undoChipButton}>
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* Wait for subgroup data before deciding which view to show — avoids flash of wrong content */}
      {!dataLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !isReadOnly ? (
        <>
          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContent}>
            {speciesLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : (
              <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                <SpeciesButtonGrid
                  species={species}
                  onSelectSpecies={({ especieId, especieCodigo }) =>
                    handleSpeciesPress(especieId, especieCodigo)
                  }
                  onNNPress={handleNNPress}
                  disabled={isReadOnly}
                />
              </Animated.View>
            )}
          </ScrollView>

          {/* Bottom action bar */}
          <View style={styles.actionBar}>
            <Pressable
              style={[styles.deleteButton, deleting && styles.buttonDisabled]}
              onPress={handleDeleteSubGroup}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              )}
            </Pressable>

            <Pressable
              style={styles.configButton}
              onPress={handleOpenConfig}
            >
              <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
            </Pressable>

            <View style={{ flex: 1 }} />

            <Pressable
              style={[styles.finalizarButton, finalizing && styles.buttonDisabled]}
              onPress={handleFinalizar}
              disabled={finalizing}
            >
              {finalizing ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.finalizarButtonText}>Finalizar</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* Read-only: show inline tree list */}
          {canReactivate && (
            <View style={styles.reactivateBar}>
              <Pressable style={styles.reactivateButton} onPress={handleReactivate}>
                <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                <Text style={styles.reactivateText}>Editar</Text>
              </Pressable>
            </View>
          )}
          <FlatList
            data={sortedTrees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.inlineListContent}
            renderItem={({ item }) => {
              const name = getSpeciesName(item);
              return (
                <View style={styles.treeRow}>
                  <Text style={styles.treeRowPos}>{item.posicion}</Text>
                  <Text style={[styles.treeRowName, item.especieId === null && styles.treeRowNameNN]} numberOfLines={1}>{name}</Text>
                  <Text style={styles.treeRowCode} numberOfLines={1}>{getSpeciesCode(item)}</Text>
                  <View style={styles.treeRowActions}>
                    {item.fotoUrl ? (
                      <Pressable
                        onPress={() => setViewingPhoto({ uri: item.fotoUrl!, treeId: item.id })}
                        hitSlop={8}
                        style={styles.treeRowBtn}
                      >
                        <Ionicons name="image" size={18} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.inlineEmptyText}>No hay árboles</Text>
            }
          />
        </>
      )}

      {/* Photo viewer modal with actions */}
      <Modal
        visible={!!viewingPhoto}
        animationType="fade"
        transparent
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.photoOverlay}>
          <Pressable style={styles.photoCloseArea} onPress={() => setViewingPhoto(null)}>
            {viewingPhoto && (
              <Image
                source={{ uri: viewingPhoto.uri }}
                style={styles.photoFull}
                resizeMode="contain"
              />
            )}
          </Pressable>
          <View style={styles.photoActions}>
            <Pressable
              style={styles.photoActionBtn}
              onPress={async () => {
                if (!viewingPhoto) return;
                const newUri = await pickPhoto();
                if (newUri) {
                  await updateTreePhoto(viewingPhoto.treeId, newUri);
                  setViewingPhoto({ uri: newUri, treeId: viewingPhoto.treeId });
                }
              }}
            >
              <Ionicons name="camera-outline" size={20} color={colors.white} />
              <Text style={styles.photoActionText}>Reemplazar</Text>
            </Pressable>
            <Pressable
              style={[styles.photoActionBtn, styles.photoActionBtnDanger]}
              onPress={async () => {
                if (!viewingPhoto) return;
                await updateTreePhoto(viewingPhoto.treeId, '');
                setViewingPhoto(null);
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.white} />
              <Text style={styles.photoActionText}>Eliminar foto</Text>
            </Pressable>
            <Pressable
              style={styles.photoActionBtn}
              onPress={() => setViewingPhoto(null)}
            >
              <Ionicons name="close" size={20} color={colors.white} />
              <Text style={styles.photoActionText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Full tree list modal */}
      <Modal
        visible={showTreeList}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTreeList(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Árboles ({totalCount})</Text>
            <Pressable onPress={() => setShowTreeList(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMedium} />
            </Pressable>
          </View>
          <FlatList
            data={sortedTrees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalListContent}
            renderItem={({ item }) => {
              const name = getSpeciesName(item);
              const isDeleting = deletingTreeId === item.id;
              return (
                <View style={styles.treeRow}>
                  <Text style={styles.treeRowPos}>{item.posicion}</Text>
                  <Text style={[styles.treeRowName, item.especieId === null && styles.treeRowNameNN]} numberOfLines={1}>{name}</Text>
                  <Text style={styles.treeRowCode} numberOfLines={1}>{getSpeciesCode(item)}</Text>
                  <View style={styles.treeRowActions}>
                    {item.fotoUrl ? (
                      <Pressable
                        onPress={() => setViewingPhoto({ uri: item.fotoUrl!, treeId: item.id })}
                        hitSlop={8}
                        style={styles.treeRowBtn}
                      >
                        <Ionicons name="image" size={18} color={colors.primary} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => handleAddPhotoToTree(item.id)}
                        hitSlop={8}
                        style={styles.treeRowBtn}
                      >
                        <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
                      </Pressable>
                    )}
                    {!isReadOnly && (
                      <Pressable
                        onPress={() => handleDeleteTree(item.id, item.posicion)}
                        hitSlop={8}
                        style={styles.treeRowBtn}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.modalEmptyText}>No hay árboles</Text>
            }
          />
        </View>
      </Modal>
      <ConfirmModal {...confirm.confirmProps} />

      {/* Config modal — Invertir + Reordenar botonera */}
      <Modal visible={showConfigModal} transparent animationType="fade" onRequestClose={() => setShowConfigModal(false)}>
        <View style={styles.configOverlay}>
          <Pressable style={styles.configBackdrop} onPress={() => setShowConfigModal(false)} />
          <View style={styles.configCard}>
            <Text style={styles.configTitle}>Opciones</Text>

            {!isReadOnly && (
              <Pressable style={styles.configOption} onPress={handleReverseOrder}>
                <Ionicons name="swap-vertical-outline" size={22} color={colors.secondary} />
                <View style={styles.configOptionInfo}>
                  <Text style={styles.configOptionLabel}>Invertir orden de árboles</Text>
                  <Text style={styles.configOptionDesc}>Invierte las posiciones y recalcula codigos</Text>
                </View>
              </Pressable>
            )}

            <Pressable style={styles.configOption} onPress={handleOpenReorder}>
              <Ionicons name="grid-outline" size={22} color={colors.info} />
              <View style={styles.configOptionInfo}>
                <Text style={styles.configOptionLabel}>Reordenar botonera</Text>
                <Text style={styles.configOptionDesc}>Personaliza el orden de los botones de especies</Text>
              </View>
            </Pressable>

            <Pressable style={styles.configCancelBtn} onPress={() => setShowConfigModal(false)}>
              <Text style={styles.configCancelText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Reorder modal — draggable species list */}
      <Modal visible={showReorderModal} animationType="slide" onRequestClose={() => setShowReorderModal(false)}>
        <GestureHandlerRootView style={styles.reorderContainer}>
          <View style={styles.reorderHeader}>
            <Text style={styles.reorderTitle}>Reordenar botonera</Text>
            <Text style={styles.reorderHint}>Mantene presionado para arrastrar</Text>
          </View>
          <View style={{ flex: 1 }}>
            <SpeciesReorderList items={reorderItems} onReorder={setReorderItems} />
          </View>
          <View style={styles.reorderFooter}>
            <Pressable
              style={({ pressed }) => [styles.reorderCancelBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShowReorderModal(false)}
            >
              <Text style={styles.reorderCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.reorderSaveBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSaveReorder}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.reorderSaveText}>Guardar</Text>
            </Pressable>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginLeft: spacing.md,
  },
  headerCount: {
    color: colors.primaryCountFaded,
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
  },
  headerNNBadge: {
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.lg,
  },
  headerNNText: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontFamily: fonts.bold,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  viewAllText: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  lastThreeSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  lastThreeLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  lastThreeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  treeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.recentBg,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.recentBorder,
    gap: spacing.sm,
    width: CHIP_WIDTH,
  },
  treeChipEmpty: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  treeChipLast: {
    backgroundColor: colors.recentBgActive,
    borderColor: colors.recentText,
    borderWidth: 2,
  },
  treeChipText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semiBold,
    color: colors.recentText,
  },
  treeChipTextLast: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
  },
  undoChipButton: {
    padding: spacing.xs,
  },
  gridScroll: {
    flex: 1,
  },
  gridContent: {
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  loader: {
    marginTop: spacing['6xl'],
  },
  actionBar: {
    flexDirection: 'row',
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configButton: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizarButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing['4xl'],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  finalizarButtonText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  reactivateBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryBg,
    alignItems: 'flex-start',
  },
  reactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  reactivateText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.base,
  },
  inlineListContent: {
    padding: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing['6xl'],
  },
  inlineEmptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing['6xl'],
    fontSize: fontSize.lg,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  modalListContent: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalEmptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing['6xl'],
    fontSize: fontSize.lg,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  treeRowPos: {
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
    color: colors.textMedium,
    width: 26,
    textAlign: 'center',
  },
  treeRowName: {
    fontSize: fontSize.md,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    flex: 1,
  },
  treeRowNameNN: {
    color: colors.secondary,
  },
  treeRowSubId: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: 'monospace',
    minWidth: 70,
  },
  treeRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  treeRowCode: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    minWidth: 40,
  },
  treeRowBtn: {
    padding: spacing.xs,
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  photoCloseArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoFull: {
    width: '90%',
    height: '70%',
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingBottom: spacing['6xl'],
    paddingTop: spacing.xl,
  },
  photoActionBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  photoActionBtnDanger: {
    opacity: 0.9,
  },
  photoActionText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
  // ─── Config modal ────────────────────────────────────────────────────────
  configOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  configBackdrop: {
    flex: 1,
  },
  configCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.round,
    borderTopRightRadius: borderRadius.round,
    padding: spacing['4xl'],
    gap: spacing.lg,
  },
  configTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  configOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
  },
  configOptionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  configOptionLabel: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  configOptionDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  configCancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.sm,
  },
  configCancelText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    fontFamily: fonts.medium,
  },
  // ─── Reorder modal ──────────────────────────────────────────────────────
  reorderContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  reorderHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing['4xl'],
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  reorderTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  reorderHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  reorderFooter: {
    flexDirection: 'row',
    gap: spacing.xl,
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reorderCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reorderCancelText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  reorderSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    gap: spacing.sm,
  },
  reorderSaveText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
});
