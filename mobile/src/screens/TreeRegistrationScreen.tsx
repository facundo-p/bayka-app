import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePhotoCapture } from '../hooks/usePhotoCapture';
import { useTreeRegistration } from '../hooks/useTreeRegistration';
import { useSpeciesOrder } from '../hooks/useSpeciesOrder';
import { useNNFlow } from '../hooks/useNNFlow';
import TreeRegistrationHeader from '../components/TreeRegistrationHeader';
import LastThreeTrees from '../components/LastThreeTrees';
import SpeciesButtonGrid from '../components/SpeciesButtonGrid';
import SpeciesReorderModal from '../components/SpeciesReorderModal';
import PhotoViewerModal from '../components/PhotoViewerModal';
import TreeListModal from '../components/TreeListModal';
import TreeConfigModal from '../components/TreeConfigModal';
import ReadOnlyTreeView from '../components/ReadOnlyTreeView';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { showConfirmDialog, showDoubleConfirmDialog, showInfoDialog } from '../utils/alertHelpers';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
export default function TreeRegistrationScreen() {
  const { id: subgrupoId } = useLocalSearchParams<{
    id: string; plantacionId: string; subgrupoCodigo: string; subgrupoNombre: string;
  }>();
  const { plantacionId, subgrupoCodigo, subgrupoNombre } = useLocalSearchParams<{
    plantacionId: string; subgrupoCodigo: string; subgrupoNombre: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const userId = useCurrentUserId() ?? '';
  const confirm = useConfirm();
  const { pickPhoto } = usePhotoCapture(confirm.show);

  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; treeId: string } | null>(null);
  const [showTreeList, setShowTreeList] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);

  const treeReg = useTreeRegistration({
    subgrupoId: subgrupoId ?? '',
    plantacionId: plantacionId ?? '',
    subgrupoCodigo: subgrupoCodigo ?? '',
    userId,
  });
  const speciesOrder = useSpeciesOrder(plantacionId ?? '');
  const nnFlow = useNNFlow({
    subgrupoId: subgrupoId ?? '',
    subgrupoCodigo: subgrupoCodigo ?? '',
    userId,
    isReadOnly: treeReg.isReadOnly,
    unresolvedNN: treeReg.unresolvedNN,
    pickPhoto,
  });

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  function handleReverseOrder() {
    setShowConfigModal(false);
    if (treeReg.isReadOnly) return;
    showConfirmDialog(confirm.show, 'Invertir Orden',
      'Invertir el orden de los árboles? Se recalcularán todas las posiciones y códigos.',
      'Invertir', () => treeReg.executeReverseOrder(), { icon: 'swap-vertical-outline' });
  }

  function handleFinalizar() {
    if (treeReg.isReadOnly) return;
    if (treeReg.totalCount === 0) {
      showInfoDialog(confirm.show, 'No se puede finalizar', 'No hay árboles cargados.',
        'information-circle-outline', colors.secondary);
      return;
    }
    const nnWarn = treeReg.unresolvedNN > 0
      ? ` Hay ${treeReg.unresolvedNN} árbol${treeReg.unresolvedNN > 1 ? 'es' : ''} N/N sin resolver.\n      (deberan resolverse antes de sincronizar).`
      : '';
    showConfirmDialog(confirm.show, 'Finalizar subgrupo',
      `Confirmar finalización? \n      ${nnWarn}`, 'Finalizar',
      () => treeReg.executeFinalize(), { icon: 'checkmark-circle-outline', style: 'primary' });
  }

  function handleDeleteSubGroup() {
    if (treeReg.isReadOnly) return;
    const warn = treeReg.totalCount > 0
      ? `Este subgrupo tiene ${treeReg.totalCount} árbol${treeReg.totalCount > 1 ? 'es' : ''} cargado${treeReg.totalCount > 1 ? 's' : ''}. Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.';
    showDoubleConfirmDialog(confirm.show, 'Eliminar subgrupo', warn, 'Confirmar eliminación',
      'Esta es la confirmación final. El subgrupo y todos sus árboles serán eliminados permanentemente.',
      () => treeReg.executeDeleteSubgroup());
  }

  function handleReactivate() {
    if (!subgrupoId || !treeReg.canReactivate) return;
    showConfirmDialog(confirm.show, 'Reactivar subgrupo',
      'Cambiar el estado del subgrupo a activa? Podrás registrar más árboles.',
      'Reactivar', () => treeReg.executeReactivate(), { icon: 'refresh-outline' });
  }

  function handleDeleteTree(treeId: string, posicion: number) {
    if (treeReg.isReadOnly) return;
    showConfirmDialog(confirm.show, 'Eliminar árbol',
      `Eliminar el árbol en posición ${posicion}? Las posiciones se recalcularán automáticamente.`,
      'Eliminar', () => treeReg.executeDeleteTree(treeId),
      { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' });
  }

  const { dataLoaded, isReadOnly, canReactivate, totalCount, unresolvedNN,
    sortedTrees, lastThree, finalizing, deleting, deletingTreeId } = treeReg;

  return (
    <View style={styles.container}>
      <TreeRegistrationHeader
        title={subgrupoNombre ?? subgrupoCodigo ?? ''}
        subtitle={treeReg.subgroup
          ? `${treeReg.subgroup.codigo} · ${treeReg.subgroup.tipo === 'linea' ? 'Línea' : 'Parcela'}`
          : undefined}
        treeCount={totalCount}
        unresolvedNN={unresolvedNN}
        onBack={() => router.back()}
      />

      {dataLoaded && !isReadOnly && (
        <Pressable
          style={({ pressed }) => [styles.viewAllRow, pressed && totalCount > 0 && { opacity: 0.7 }]}
          onPress={() => totalCount > 0 && setShowTreeList(true)}
          disabled={totalCount === 0}
        >
          <Ionicons name="list-outline" size={16} color={totalCount > 0 ? colors.plantation : colors.textLight} />
          <Text style={[styles.viewAllText, totalCount === 0 && { color: colors.textLight }]}>
            {totalCount > 0 ? 'Ver todos los árboles' : 'Sin árboles cargados'}
          </Text>
          {totalCount > 0 && <Ionicons name="chevron-forward" size={14} color={colors.plantation} />}
        </Pressable>
      )}

      {dataLoaded && !isReadOnly && (
        <LastThreeTrees trees={lastThree} onUndo={() => treeReg.undoLast()} />
      )}

      {!dataLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.plantation} />
        </View>
      ) : !isReadOnly ? (
        <>
          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContent}>
            {speciesOrder.loading ? (
              <ActivityIndicator size="large" color={colors.plantation} style={styles.loader} />
            ) : (
              <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                <SpeciesButtonGrid
                  species={speciesOrder.orderedSpecies}
                  onSelectSpecies={({ especieId, especieCodigo }) =>
                    treeReg.registerTree(especieId, especieCodigo)
                  }
                  onNNPress={() => nnFlow.registerNN()}
                  disabled={isReadOnly}
                />
              </Animated.View>
            )}
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable style={[styles.deleteButton, deleting && styles.buttonDisabled]}
              onPress={handleDeleteSubGroup} disabled={deleting}>
              {deleting ? <ActivityIndicator size="small" color={colors.danger} />
                : <Ionicons name="trash-outline" size={20} color={colors.danger} />}
            </Pressable>
            <Pressable style={styles.configButton} onPress={() => setShowConfigModal(true)}>
              <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable style={[styles.finalizarButton, finalizing && styles.buttonDisabled]}
              onPress={handleFinalizar} disabled={finalizing}>
              {finalizing ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.finalizarButtonText}>Finalizar</Text>}
            </Pressable>
          </View>
        </>
      ) : (
        <ReadOnlyTreeView
          trees={sortedTrees}
          canReactivate={canReactivate}
          onReactivate={handleReactivate}
          onViewPhoto={(treeId, uri) => setViewingPhoto({ uri, treeId })}
        />
      )}

      <TreeListModal
        visible={showTreeList}
        trees={sortedTrees}
        isReadOnly={isReadOnly}
        deletingTreeId={deletingTreeId}
        onClose={() => setShowTreeList(false)}
        onViewPhoto={(treeId, uri) => setViewingPhoto({ uri, treeId })}
        onAttachPhoto={(treeId) => treeReg.addPhotoToTree(treeId, pickPhoto)}
        onDeleteTree={handleDeleteTree}
      />

      <PhotoViewerModal
        visible={!!viewingPhoto}
        photoUri={viewingPhoto?.uri ?? null}
        onClose={() => setViewingPhoto(null)}
        onReplace={async () => {
          if (!viewingPhoto) return;
          const newUri = await pickPhoto();
          if (newUri) {
            await treeReg.updatePhoto(viewingPhoto.treeId, newUri);
            setViewingPhoto({ uri: newUri, treeId: viewingPhoto.treeId });
          }
        }}
        onRemove={async () => {
          if (!viewingPhoto) return;
          await treeReg.removePhoto(viewingPhoto.treeId);
          setViewingPhoto(null);
        }}
      />

      <ConfirmModal {...confirm.confirmProps} />

      <TreeConfigModal
        visible={showConfigModal}
        isReadOnly={isReadOnly}
        onClose={() => setShowConfigModal(false)}
        onReverseOrder={handleReverseOrder}
        onReorderSpecies={() => {
          setShowConfigModal(false);
          speciesOrder.initReorderFromCurrent();
          setShowReorderModal(true);
        }}
      />

      <SpeciesReorderModal
        visible={showReorderModal}
        items={speciesOrder.reorderItems}
        onReorder={speciesOrder.setReorderItems}
        onCancel={() => setShowReorderModal(false)}
        onSave={async () => {
          await speciesOrder.saveReorder(userId, plantacionId ?? '');
          setShowReorderModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewAllRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.plantationBg,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm,
  },
  viewAllText: { flex: 1, fontSize: fontSize.md, fontFamily: fonts.semiBold, color: colors.plantation },
  gridScroll: { flex: 1 },
  gridContent: { paddingTop: spacing.md, flexGrow: 1 },
  loader: { marginTop: spacing['6xl'] },
  actionBar: {
    flexDirection: 'row', padding: spacing.xl, gap: spacing.lg,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  deleteButton: {
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: borderRadius.lg,
    borderWidth: 2, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  configButton: {
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: borderRadius.lg,
    borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  finalizarButton: {
    paddingVertical: 14, paddingHorizontal: spacing['4xl'],
    borderRadius: borderRadius.lg, backgroundColor: colors.plantationHeaderBg, alignItems: 'center',
  },
  finalizarButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.lg },
  buttonDisabled: { opacity: 0.5 },
});
