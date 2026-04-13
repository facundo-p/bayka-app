import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import PlantationCard from '../components/PlantationCard';
import FilterCards from '../components/FilterCards';
import ScreenHeader from '../components/ScreenHeader';
import TexturedBackground from '../components/TexturedBackground';
import ConfirmModal from '../components/ConfirmModal';
import AdminBottomSheet from '../components/AdminBottomSheet';
import AdminPlantationModals from '../components/AdminPlantationModals';
import SyncConfirmModal from '../components/SyncConfirmModal';
import SyncProgressModal from '../components/SyncProgressModal';
import DownloadProgressModal from '../components/DownloadProgressModal';
import { usePlantaciones } from '../hooks/usePlantaciones';
import { usePlantationAdmin, fetchPlantationMeta } from '../hooks/usePlantationAdmin';
import { useSync } from '../hooks/useSync';
import { showConfirmDialog } from '../utils/alertHelpers';
import type { ExpandedMeta } from '../hooks/usePlantationAdmin';
import type { Plantation } from '../components/PlantationConfigCard';

export default function PlantacionesScreen() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();

  const {
    plantationList,
    filteredList,
    estadoCounts,
    activeFilter,
    setActiveFilter,
    headerTitle,
    isOnline,
    isAdmin,
    syncedCountMap,
    pendingSyncMap,
    todayCountMap,
    totalCountMap,
    handleDeletePlantation,
    confirmProps,
  } = usePlantaciones();

  // Always call the hook (React rules of hooks)
  const adminHook = usePlantationAdmin();

  // Bottom sheet state
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetPlantation, setBottomSheetPlantation] = useState<Plantation | null>(null);
  const [bottomSheetMeta, setBottomSheetMeta] = useState<ExpandedMeta>({ canFinalize: false, idsGenerated: false });

  // Admin modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configSpeciesPlantacionId, setConfigSpeciesPlantacionId] = useState<string | null>(null);
  const [assignTechPlantacionId, setAssignTechPlantacionId] = useState<string | null>(null);
  const [editingPlantation, setEditingPlantation] = useState<Plantation | null>(null);

  // Sync/download state
  const [syncPlantacionId, setSyncPlantacionId] = useState('');
  const [syncConfirmMode, setSyncConfirmMode] = useState<'download' | 'upload' | null>(null);
  const sync = useSync(syncPlantacionId);

  const filterConfigs = [
    { key: 'activa', label: 'Activas', count: estadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: estadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

  async function handleOpenGear(item: any) {
    const plantation = item as Plantation;
    setBottomSheetPlantation(plantation);
    const meta = await fetchPlantationMeta(plantation);
    setBottomSheetMeta(meta);
    setBottomSheetVisible(true);
  }

  function handleEditPress(item: any) {
    const plantation = item as Plantation;
    if (plantation.estado === 'activa') {
      setEditingPlantation(plantation);
    } else {
      Alert.alert('No disponible', 'No se puede editar una plantacion finalizada');
    }
  }

  function handleBottomSheetAction(action: () => void | Promise<void>) {
    setBottomSheetVisible(false);
    action();
  }

  async function onAssignTechFromSheet(plantacionId: string) {
    setBottomSheetVisible(false);
    const ok = await adminHook.handleAssignTech(plantacionId);
    if (ok) setAssignTechPlantacionId(plantacionId);
  }

  function handleDownloadFromSheet() {
    if (!bottomSheetPlantation) return;
    setSyncPlantacionId(bottomSheetPlantation.id);
    setBottomSheetVisible(false);
    setSyncConfirmMode('download');
  }

  function handleSyncFromSheet() {
    if (!bottomSheetPlantation) return;
    setSyncPlantacionId(bottomSheetPlantation.id);
    setBottomSheetVisible(false);
    setSyncConfirmMode('upload');
  }

  function handleSyncConfirm(incluirFotos: boolean) {
    setSyncConfirmMode(null);
    if (syncConfirmMode === 'download') {
      sync.startPull(incluirFotos);
    } else {
      sync.startSync(incluirFotos);
    }
  }

  return (
    <TexturedBackground>
      <ScreenHeader
        title={headerTitle}
        rightElement={
          <View style={styles.headerButtons}>
            {isAdmin && (
              <Pressable
                style={({ pressed }) => [styles.headerAddBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowCreateModal(true)}
                accessibilityLabel="Nueva plantacion"
              >
                <Ionicons name="add" size={18} color={colors.white} />
              </Pressable>
            )}
            <Pressable
              onPress={() => { if (isOnline) router.push(`/${routePrefix}/plantation/catalog` as any); }}
              disabled={!isOnline}
              hitSlop={8}
              style={({ pressed }) => [
                styles.catalogButton,
                !isOnline && styles.catalogButtonDisabled,
                pressed && isOnline && styles.catalogButtonPressed,
              ]}
              accessibilityLabel="Gestionar plantaciones descargadas"
            >
              <Ionicons name="download-outline" size={18} color={isOnline ? colors.white : colors.offline} />
            </Pressable>
          </View>
        }
      />

      {plantationList && plantationList.length > 0 ? (
        <>
          <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: spacing.xxl, paddingTop: spacing.xl }}>
            <FilterCards
              filters={filterConfigs}
              activeFilter={activeFilter}
              onToggleFilter={(key) => setActiveFilter(prev => prev === key ? null : key)}
            />
          </Animated.View>

          <FlatList
            data={filteredList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            testID="plantaciones-list"
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 80).duration(300)} testID={`plantation-card-${item.id}`}>
                <PlantationCard
                  lugar={item.lugar}
                  periodo={item.periodo}
                  totalCount={totalCountMap.get(item.id) ?? 0}
                  syncedCount={syncedCountMap.get(item.id) ?? 0}
                  todayCount={todayCountMap.get(item.id) ?? 0}
                  pendingSync={pendingSyncMap.get(item.id) ?? 0}
                  estado={item.estado}
                  onPress={() => router.push(`/${routePrefix}/plantation/${item.id}` as any)}
                  onDelete={() => handleDeletePlantation(item.id)}
                  isAdmin={isAdmin}
                  onEdit={() => handleEditPress(item)}
                  onGear={() => handleOpenGear(item)}
                />
              </Animated.View>
            )}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No hay plantaciones disponibles</Text>
          <Text style={styles.emptySubtext}>Las plantaciones asignadas apareceran aqui</Text>
        </View>
      )}

      <ConfirmModal {...confirmProps} />

      <AdminBottomSheet
        visible={bottomSheetVisible}
        plantation={bottomSheetPlantation}
        meta={bottomSheetMeta}
        isAdmin={isAdmin}
        isOnline={isOnline}
        onDismiss={() => setBottomSheetVisible(false)}
        onDownload={handleDownloadFromSheet}
        onSync={handleSyncFromSheet}
        onConfigSpecies={() => handleBottomSheetAction(() => setConfigSpeciesPlantacionId(bottomSheetPlantation?.id ?? null))}
        onAssignTech={() => { if (bottomSheetPlantation) onAssignTechFromSheet(bottomSheetPlantation.id); }}
        onFinalize={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleFinalize(bottomSheetPlantation.id); })}
        onGenerateIds={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleGenerateIds(bottomSheetPlantation.id); })}
        onExportCsv={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleExportCsv(bottomSheetPlantation.id); })}
        onExportExcel={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleExportExcel(bottomSheetPlantation.id); })}
        onDiscardEdit={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleDiscardEdit(bottomSheetPlantation.id); })}
      />

      <SyncConfirmModal
        visible={syncConfirmMode !== null}
        mode={syncConfirmMode ?? 'download'}
        onConfirm={handleSyncConfirm}
        onClose={() => setSyncConfirmMode(null)}
      />

      <SyncProgressModal
        state={sync.state}
        progress={sync.progress}
        results={sync.results}
        successCount={sync.successCount}
        failureCount={sync.failureCount}
        pullSuccess={sync.pullSuccess}
        photoProgress={sync.photoProgress}
        photoResult={sync.photoResult}
        onDismiss={sync.reset}
      />

      {isAdmin && (
        <AdminPlantationModals
          showCreateModal={showCreateModal}
          onCloseCreate={() => setShowCreateModal(false)}
          onCreateSubmit={async (lugar, periodo) => { await adminHook.handleCreateSubmit(lugar, periodo); setShowCreateModal(false); }}
          editingPlantation={editingPlantation}
          onCloseEdit={() => setEditingPlantation(null)}
          onEditSubmit={async (lugar, periodo) => { if (editingPlantation) { await adminHook.handleEditSubmit(editingPlantation.id, lugar, periodo); setEditingPlantation(null); } }}
          confirmProps={adminHook.confirmProps}
          seedModalPlantacionId={adminHook.seedModalPlantacionId}
          seedValue={adminHook.seedValue}
          setSeedValue={adminHook.setSeedValue}
          seedLoading={adminHook.seedLoading}
          onCloseSeed={() => adminHook.setSeedModalPlantacionId(null)}
          onConfirmSeed={adminHook.confirmSeedAndGenerate}
          exportingId={adminHook.exportingId}
          configSpeciesPlantacionId={configSpeciesPlantacionId}
          onCloseConfigSpecies={() => setConfigSpeciesPlantacionId(null)}
          pendingSyncForSpecies={(adminHook.plantationList as Plantation[] | null)?.find(p => p.id === configSpeciesPlantacionId)?.pendingSync}
          assignTechPlantacionId={assignTechPlantacionId}
          onCloseAssignTech={() => setAssignTechPlantacionId(null)}
        />
      )}
    </TexturedBackground>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.textMuted },
  emptySubtext: { fontSize: fontSize.base, color: colors.textLight },
  listContent: { padding: spacing.xxl, paddingTop: spacing['4xl'], paddingBottom: spacing['6xl'], gap: spacing.xl },
  catalogButton: { backgroundColor: colors.primary, borderRadius: borderRadius.full, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  catalogButtonDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.offline },
  catalogButtonPressed: { opacity: 0.7 },
});
