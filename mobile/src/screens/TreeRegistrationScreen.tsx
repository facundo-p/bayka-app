import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import PhotoViewer from '../components/PhotoViewer';
import TreeListModal from '../components/TreeListModal';
import TreeDetailModal from '../components/TreeDetailModal';
import TreeConfigModal from '../components/TreeConfigModal';
import ReadOnlyTreeView from '../components/ReadOnlyTreeView';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { GROUP_TIPO_LABELS, type GroupTipo } from '../constants/groupTipo';
import { styles } from './TreeRegistrationScreen.styles';
import ScreenContainer from '../components/ScreenContainer';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { showConfirmDialog, showDoubleConfirmDialog, showInfoDialog } from '../utils/alertHelpers';
import { useConfirm } from '../hooks/useConfirm';
import { useGpsWatcher } from '../hooks/useGpsWatcher';
import { useGpsEnabledSetting } from '../hooks/useGpsEnabledSetting';
import ConfirmModal from '../components/ConfirmModal';
import GpsSignalIndicator from '../components/GpsSignalIndicator';
import GpsGateBanner from '../components/GpsGateBanner';
import LastTreeGpsRow from '../components/LastTreeGpsRow';
import { useGpsGate } from '../hooks/useGpsGate';
import { getTreeEditGating } from '../utils/treeEditGating';

export default function TreeRegistrationScreen() {
  const { id: grupoId } = useLocalSearchParams<{
    id: string; plantacionId: string; grupoCodigo: string; grupoNombre: string;
  }>();
  const { plantacionId, grupoCodigo, grupoNombre } = useLocalSearchParams<{
    plantacionId: string; grupoCodigo: string; grupoNombre: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const userId = useCurrentUserId() ?? '';
  const confirm = useConfirm();
  const { pickPhoto } = usePhotoCapture(confirm.show);

  // Surface de errores de escritura (#90): cualquier writer que falle (registro,
  // borrado, foto, finalización) se notifica acá — antes era unhandled rejection.
  const showWriteError = useCallback((mensaje: string) => {
    showInfoDialog(confirm.show, 'Error', mensaje, 'alert-circle-outline', colors.danger);
  }, [confirm.show]);

  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; treeId: string } | null>(null);
  const [showTreeList, setShowTreeList] = useState(false);
  const [editingTreeId, setEditingTreeId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);

  const { gpsEnabled } = useGpsEnabledSetting();
  const gpsWatcher = useGpsWatcher(gpsEnabled);
  const treeReg = useTreeRegistration({
    grupoId: grupoId ?? '',
    plantacionId: plantacionId ?? '',
    grupoCodigo: grupoCodigo ?? '',
    userId,
    getLastGpsFix: gpsWatcher.getLastFix,
    onError: showWriteError,
  });
  const gpsGate = useGpsGate({
    required: treeReg.gpsCaptureRequired,
    gpsEnabled,
    permissionStatus: gpsWatcher.permissionStatus,
    servicesEnabled: gpsWatcher.servicesEnabled,
    refreshWatcher: gpsWatcher.refresh,
  });
  const speciesOrder = useSpeciesOrder(plantacionId ?? '');
  const nnFlow = useNNFlow({
    grupoId: grupoId ?? '',
    grupoCodigo: grupoCodigo ?? '',
    userId,
    isReadOnly: treeReg.isReadOnly,
    unresolvedNN: treeReg.unresolvedNN,
    pickPhoto,
    gpsCaptureFrequency: treeReg.gpsCaptureFrequency,
    getLastGpsFix: gpsWatcher.getLastFix,
    onError: showWriteError,
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
    showConfirmDialog(confirm.show, 'Finalizar grupo',
      `Confirmar finalización? \n      ${nnWarn}`, 'Finalizar',
      () => treeReg.executeFinalize(), { icon: 'checkmark-circle-outline', style: 'primary' });
  }

  function handleDeleteGroup() {
    if (treeReg.isReadOnly) return;
    const warn = treeReg.totalCount > 0
      ? `Este grupo tiene ${treeReg.totalCount} árbol${treeReg.totalCount > 1 ? 'es' : ''} cargado${treeReg.totalCount > 1 ? 's' : ''}. Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.';
    showDoubleConfirmDialog(confirm.show, 'Eliminar grupo', warn, 'Confirmar eliminación',
      'Esta es la confirmación final. El grupo y todos sus árboles serán eliminados permanentemente.',
      () => treeReg.executeDeleteGroup());
  }

  function handleReactivate() {
    if (!grupoId || !treeReg.canReactivate) return;
    showConfirmDialog(confirm.show, 'Reactivar grupo',
      'Cambiar el estado del grupo a activa? Podrás registrar más árboles.',
      'Reactivar', () => treeReg.executeReactivate(), { icon: 'refresh-outline' });
  }

  async function handleRecaptureGps() {
    const captured = await treeReg.recaptureLastGps();
    if (!captured) {
      showInfoDialog(confirm.show, 'Sin señal GPS',
        'No se pudo obtener un punto. El punto anterior se conserva; probá de nuevo cuando mejore la señal.',
        'locate-outline', colors.secondary);
    }
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

  // Gating del detalle de árbol (issue #155) — ver getTreeEditGating.
  const { canEdit: canEditTree, canDelete: canDeleteTree } = getTreeEditGating({
    plantacionEstado: treeReg.plantacionEstado,
    subgroupEstado: treeReg.subgroupEstado,
    isCreator: treeReg.isCreator,
  });

  return (
    <ScreenContainer withTexture>
      <TreeRegistrationHeader
        title={grupoNombre ?? grupoCodigo ?? ''}
        subtitle={treeReg.subgroup
          ? `${treeReg.subgroup.codigo} · ${GROUP_TIPO_LABELS[treeReg.subgroup.tipo as GroupTipo]}`
          : undefined}
        treeCount={totalCount}
        unresolvedNN={unresolvedNN}
        onBack={() => router.back()}
      />

      {dataLoaded && !isReadOnly && (
        <Pressable
          style={({ pressed }) => [styles.viewAllRow, pressed && totalCount > 0 && styles.viewAllRowPressed]}
          onPress={() => totalCount > 0 && setShowTreeList(true)}
          disabled={totalCount === 0}
        >
          <Ionicons name="list-outline" size={16} color={totalCount > 0 ? colors.plantation : colors.textLight} />
          <Text style={[styles.viewAllText, totalCount === 0 && styles.viewAllTextDisabled]}>
            {totalCount > 0 ? 'Ver todos los árboles' : 'Sin árboles cargados'}
          </Text>
          {totalCount > 0 && <Ionicons name="chevron-forward" size={14} color={colors.plantation} />}
        </Pressable>
      )}

      {dataLoaded && !isReadOnly && (
        <LastThreeTrees
          trees={lastThree}
          onUndo={() => treeReg.undoLast()}
          headerAccessory={
            <GpsSignalIndicator
              lastFix={gpsWatcher.lastFix}
              permissionStatus={gpsWatcher.permissionStatus}
              servicesEnabled={gpsWatcher.servicesEnabled}
            />
          }
          footerAccessory={
            lastThree.length > 0 ? (
              <LastTreeGpsRow
                hasPoint={lastThree[0].latitude != null}
                gpsAccuracy={lastThree[0].gpsAccuracy ?? null}
                recapturing={treeReg.recapturingGps}
                onRecapture={handleRecaptureGps}
              />
            ) : undefined
          }
        />
      )}

      {!dataLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.plantation} />
        </View>
      ) : !isReadOnly ? (
        <>
          {gpsGate.blocked && (
            <GpsGateBanner
              message={gpsGate.message!}
              unblocking={gpsGate.unblocking}
              onRequestUnblock={gpsGate.requestUnblock}
            />
          )}
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
                  disabled={isReadOnly || gpsGate.blocked}
                />
              </Animated.View>
            )}
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable style={[styles.deleteButton, deleting && styles.buttonDisabled]}
              onPress={handleDeleteGroup} disabled={deleting}>
              {deleting ? <ActivityIndicator size="small" color={colors.danger} />
                : <Ionicons name="trash-outline" size={20} color={colors.danger} />}
            </Pressable>
            <Pressable style={styles.configButton} onPress={() => setShowConfigModal(true)}>
              <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
            </Pressable>
            <View style={styles.spacer} />
            <Pressable
              testID="finalize-button"
              style={[styles.finalizarButton, finalizing && styles.buttonDisabled]}
              onPress={handleFinalizar}
              disabled={finalizing}
            >
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
          onSelectTree={setEditingTreeId}
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
        onSelectTree={(treeId) => { setShowTreeList(false); setEditingTreeId(treeId); }}
      />

      <TreeDetailModal
        visible={editingTreeId !== null}
        treeId={editingTreeId}
        canEdit={canEditTree}
        canDelete={canDeleteTree}
        onClose={() => setEditingTreeId(null)}
        onCapturePhoto={(treeId) => treeReg.addPhotoToTree(treeId, pickPhoto)}
        onRemovePhoto={(treeId) => treeReg.removePhoto(treeId)}
        onCaptureGps={(treeId) => treeReg.captureTreeGps(treeId)}
        onDelete={(treeId, posicion) => {
          setEditingTreeId(null);
          handleDeleteTree(treeId, posicion);
        }}
      />

      <PhotoViewer
        uri={viewingPhoto?.uri ?? null}
        onClose={() => setViewingPhoto(null)}
        onReplace={() => {
          if (!viewingPhoto) return;
          void pickPhoto().then((newUri) => {
            if (newUri) {
              void treeReg.updatePhoto(viewingPhoto.treeId, newUri);
              setViewingPhoto({ uri: newUri, treeId: viewingPhoto.treeId });
            }
          });
        }}
        onRemove={() => {
          if (!viewingPhoto) return;
          void treeReg.removePhoto(viewingPhoto.treeId);
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
    </ScreenContainer>
  );
}

