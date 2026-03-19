import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Alert,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Image,
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
import { captureNNPhoto, attachTreePhoto } from '../services/PhotoService';
import { useLiveData } from '../database/liveQuery';
import { db } from '../database/client';
import { subgroups } from '../database/schema';
import { eq } from 'drizzle-orm';
import SpeciesButtonGrid from '../components/SpeciesButtonGrid';
import CustomHeader from '../components/CustomHeader';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../theme';
import TreeIcon from '../components/TreeIcon';
import type { SubGroupEstado } from '../repositories/SubGroupRepository';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { showConfirmDialog, showDoubleConfirmDialog } from '../utils/alertHelpers';
import { getSpeciesCode, getSpeciesName } from '../utils/speciesHelpers';

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
  const [finalizing, setFinalizing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; treeId: string } | null>(null);
  const [showTreeList, setShowTreeList] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);

  const { allTrees, lastThree, totalCount, unresolvedNN } = useTrees(subgrupoId ?? '');
  const { species, loading: speciesLoading } = usePlantationSpecies(plantacionId ?? '');

  // Load subgroup data for ownership check
  const { data: subgroupRows } = useLiveData(
    () => db.select().from(subgroups).where(eq(subgroups.id, subgrupoId ?? '')),
    [subgrupoId]
  );
  const subgroup = subgroupRows?.[0] ?? null;
  const subgroupEstado = (subgroup?.estado ?? 'activa') as SubGroupEstado;
  const isCreator = subgroup && userId ? subgroup.usuarioCreador === userId : false;
  const isOwner = subgroup && userId
    ? canEdit({ usuarioCreador: subgroup.usuarioCreador, estado: subgroupEstado }, userId)
    : false;
  // Read-only when not owner OR when subgroup is not activa
  const isReadOnly = !isOwner || subgroupEstado !== 'activa';
  const canReactivate = isCreator && subgroupEstado === 'finalizada';

  // Hide default header, use custom one
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  async function handleSpeciesPress(especieId: string, especieCodigo: string) {
    if (isReadOnly) return;
    await insertTree({
      subgrupoId: subgrupoId ?? '',
      subgrupoCodigo: subgrupoCodigo ?? '',
      especieId,
      especieCodigo,
      userId,
    });
  }

  async function handleNNPress() {
    if (isReadOnly) return;
    const photoUri = await captureNNPhoto();
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
    const photoUri = await attachTreePhoto();
    if (!photoUri) return;
    await updateTreePhoto(treeId, photoUri);
  }

  function handleReverseOrder() {
    if (isReadOnly) return;
    showConfirmDialog(
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
    );
  }

  function handleFinalizar() {
    if (isReadOnly) return;

    if (totalCount === 0) {
      Alert.alert('No se puede finalizar', 'No hay arboles cargados.');
      return;
    }

    if (unresolvedNN > 0) {
      Alert.alert(
        'No se puede finalizar',
        `Hay ${unresolvedNN} arbol${unresolvedNN > 1 ? 'es' : ''} N/N sin resolver. Resolver arboles N/N antes de finalizar.`
      );
      return;
    }

    Alert.alert(
      'Finalizar subgrupo',
      'Confirmar finalizacion? No podras registrar mas arboles.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setFinalizing(true);
            try {
              const result = await finalizeSubGroup(subgrupoId ?? '');
              if (!result.success && result.error === 'unresolved_nn') {
                Alert.alert(
                  'No se puede finalizar',
                  `Hay ${result.count} arbol${result.count > 1 ? 'es' : ''} N/N sin resolver. Resolver arboles N/N antes de finalizar.`
                );
              } else if (result.success) {
                router.back();
              }
            } finally {
              setFinalizing(false);
            }
          },
        },
      ]
    );
  }

  function handleDeleteSubGroup() {
    if (isReadOnly) return;

    const warningMessage = totalCount > 0
      ? `Este subgrupo tiene ${totalCount} arbol${totalCount > 1 ? 'es' : ''} cargado${totalCount > 1 ? 's' : ''}. Esta accion no se puede deshacer.`
      : 'Esta accion no se puede deshacer.';

    showDoubleConfirmDialog(
      'Eliminar subgrupo',
      warningMessage,
      'Confirmar eliminacion',
      'Esta es la confirmacion final. El subgrupo y todos sus arboles seran eliminados permanentemente.',
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
    Alert.alert(
      'Reactivar subgrupo',
      'Cambiar el estado del subgrupo a activa? Podrás registrar más árboles.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reactivar',
          onPress: async () => {
            await reactivateSubGroup(subgrupoId);
          },
        },
      ]
    );
  }

  function handleDeleteTree(treeId: string, posicion: number) {
    if (isReadOnly) return;
    showConfirmDialog(
      'Eliminar arbol',
      `Eliminar el arbol en posicion ${posicion}? Las posiciones se recalcularan automaticamente.`,
      'Eliminar',
      async () => {
        setDeletingTreeId(treeId);
        try {
          await deleteTreeAndRecalculate(treeId, subgrupoId ?? '', subgrupoCodigo ?? '');
        } finally {
          setDeletingTreeId(null);
        }
      },
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

      {/* View all trees button — only in edit mode */}
      {!isReadOnly && totalCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.viewAllRow, pressed && { opacity: 0.7 }]}
          onPress={() => setShowTreeList(true)}
        >
          <Ionicons name="list-outline" size={16} color={colors.primary} />
          <Text style={styles.viewAllText}>Ver todos los árboles</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      )}

      {/* Last 3 trees — only in edit mode */}
      {!isReadOnly && (
        <View style={styles.lastThreeSection}>
          <Text style={styles.lastThreeLabel}>Últimos ingresados</Text>
          <View style={styles.lastThreeRow}>
            {lastThree.length > 0 ? (
              [...lastThree].reverse().map((tree, index) => {
                const isLast = index === lastThree.length - 1;
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
              })
            ) : (
              <Text style={styles.lastThreePlaceholder}>Sin árboles ingresados</Text>
            )}
          </View>
        </View>
      )}

      {/* Species button grid — only in edit mode */}
      {!isReadOnly ? (
        <>
          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContent}>
            {speciesLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : (
              <SpeciesButtonGrid
                species={species}
                onSelectSpecies={({ especieId, especieCodigo }) =>
                  handleSpeciesPress(especieId, especieCodigo)
                }
                onNNPress={handleNNPress}
                disabled={isReadOnly}
              />
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
              style={[styles.reverseButton, reversing && styles.buttonDisabled]}
              onPress={handleReverseOrder}
              disabled={reversing}
            >
              {reversing ? (
                <ActivityIndicator size="small" color={colors.secondary} />
              ) : (
                <Text style={styles.reverseButtonText}>Invertir</Text>
              )}
            </Pressable>

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
                const newUri = await attachTreePhoto();
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
            <Text style={styles.modalTitle}>Arboles ({totalCount})</Text>
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
              <Text style={styles.modalEmptyText}>No hay arboles</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontWeight: 'bold',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
  lastThreePlaceholder: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    fontStyle: 'italic',
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
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.recentBorder,
    gap: spacing.sm,
    flex: 1,
  },
  treeChipLast: {
    backgroundColor: colors.recentBgActive,
    borderColor: colors.recentText,
    borderWidth: 2,
  },
  treeChipText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.recentText,
  },
  treeChipTextLast: {
    fontWeight: 'bold',
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
  reverseButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: 'center',
  },
  reverseButtonText: {
    color: colors.secondary,
    fontWeight: '600',
    fontSize: fontSize.lg,
  },
  finalizarButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  finalizarButtonText: {
    color: colors.white,
    fontWeight: 'bold',
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
    fontWeight: '600',
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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: colors.textMedium,
    width: 26,
    textAlign: 'center',
  },
  treeRowName: {
    fontSize: fontSize.md,
    fontWeight: '600',
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
    fontWeight: '500',
  },
});
