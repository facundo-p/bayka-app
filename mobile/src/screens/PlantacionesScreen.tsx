import { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontSize, spacing, fonts } from '../theme';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import PlantationCard from '../components/PlantationCard';
import ParcelaFormModal from '../components/ParcelaFormModal';
import FilterCards from '../components/FilterCards';
import CustomHeader from '../components/CustomHeader';
import HeaderActionButton from '../components/HeaderActionButton';
import TexturedBackground from '../components/TexturedBackground';
import ConfirmModal from '../components/ConfirmModal';
import AdminBottomSheet from '../components/AdminBottomSheet';
import AdminPlantationModals from '../components/AdminPlantationModals';
import SyncProgressModal from '../components/SyncProgressModal';
import SyncConfirmModal from '../components/SyncConfirmModal';
import { usePlantaciones } from '../hooks/usePlantaciones';
import { usePlantationAdmin, fetchPlantationMeta } from '../hooks/usePlantationAdmin';
import { useSync } from '../hooks/useSync';
import { useAuth } from '../hooks/useAuth';
import { showConfirmDialog } from '../utils/alertHelpers';
import type { ExpandedMeta } from '../hooks/usePlantationAdmin';
import type { Plantation } from '../components/PlantationConfigCard';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { usePendingSyncMap } from '../hooks/usePendingSyncMap';
import { useParcelas } from '../hooks/useParcelas';
import type { ParcelaWithStats } from '../queries/parcelaQueries';
import type { Parcela } from '../repositories/ParcelaRepository';

/**
 * ExpandablePlantationCard — wrapper that pulls parcelas per plantation
 * via `useParcelas` so `PlantationCard` can render "Parcelas: N" and the
 * inline expanded list (Plan 17-02 Task 2.4, D-17-10..14).
 *
 * `useParcelas` is invoked unconditionally to honor the Rules of Hooks;
 * the cost is one indexed query per card. The FPS gate (≥50 FPS over 3s
 * scroll of 10 cards) is the merge criterion — if it regresses, pivot to
 * a lightweight `useParcelasCount` hook for collapsed cards.
 */
type ExpandableCardProps = {
  plantacionId: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onParcelaPress: (parcelaId: string) => void;
  onParcelaLongPress: (parcela: ParcelaWithStats) => void;
  // Pass-through to PlantationCard
  cardProps: Omit<
    React.ComponentProps<typeof PlantationCard>,
    'parcelasCount' | 'parcelas' | 'expanded' | 'onToggleExpanded' | 'onParcelaPress' | 'onParcelaLongPress'
  >;
};

function ExpandablePlantationCard({
  plantacionId,
  expanded,
  onToggleExpanded,
  onParcelaPress,
  onParcelaLongPress,
  cardProps,
}: ExpandableCardProps) {
  const { parcelas } = useParcelas(plantacionId);
  return (
    <PlantationCard
      {...cardProps}
      parcelasCount={parcelas.length}
      parcelas={expanded ? parcelas : undefined}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
      onParcelaPress={onParcelaPress}
      onParcelaLongPress={onParcelaLongPress}
    />
  );
}

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
    headerSubtitle,
    isOnline,
    isAdmin,
    syncedCountMap,
    pendingSyncMap,
    todayCountMap,
    totalCountMap,
    nnCountMap,
    handleDeletePlantation,
    confirmProps,
  } = usePlantaciones();

  // Always call the hook (React rules of hooks)
  const adminHook = usePlantationAdmin();

  // Global sync state
  const { state: syncState, startGlobalSync, startPlantationSync, globalProgress, progress, results, parcelaResults, plantationResults, reset: resetSync, pullSuccess, authExpired, successCount, failureCount, parcelaFailureCount, plantationFailureCount, photoProgress, photoResult } = useSync();
  const { signOut } = useAuth();

  // Sesión expirada durante el sync: "Aceptar" cierra sesión (el root layout
  // redirige a login); "Cancelar" solo descarta el aviso.
  const handleSessionExpiredReauth = useCallback(() => {
    resetSync();
    signOut();
  }, [resetSync, signOut]);
  const { pendingCount: globalPendingCount } = usePendingSyncCount();
  const hasAnyPending = globalPendingCount > 0;
  const isSyncing = syncState !== 'idle' && syncState !== 'done';

  // Per-plantation pending status for hasPendingSync prop
  const pendingSyncBoolMap = usePendingSyncMap();

  // Sync confirm dialog state
  const [syncConfirmVisible, setSyncConfirmVisible] = useState(false);
  const [syncConfirmMode, setSyncConfirmMode] = useState<'global' | 'plantation'>('global');
  const [syncTargetPlantationId, setSyncTargetPlantationId] = useState<string | null>(null);

  function showSyncConfirm(mode: 'global' | 'plantation', plantationId?: string) {
    setSyncConfirmMode(mode);
    setSyncTargetPlantationId(plantationId ?? null);
    setSyncConfirmVisible(true);
  }

  function handleSyncConfirm(incluirFotos: boolean) {
    setSyncConfirmVisible(false);
    if (syncConfirmMode === 'global') {
      startGlobalSync(incluirFotos);
    } else if (syncTargetPlantationId) {
      startPlantationSync(syncTargetPlantationId, incluirFotos);
    }
  }

  // Bottom sheet state
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetPlantation, setBottomSheetPlantation] = useState<Plantation | null>(null);
  const [bottomSheetMeta, setBottomSheetMeta] = useState<ExpandedMeta>({ canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0 });

  // Plan 17-02: single-card expansion + inline parcela edit modal
  const [expandedPlantationId, setExpandedPlantationId] = useState<string | null>(null);
  const [editingParcela, setEditingParcela] = useState<Parcela | null>(null);
  const [editingParcelaPlantacionId, setEditingParcelaPlantacionId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((id: string) => {
    // La animación de expansión la maneja reanimated (LinearTransition en el
    // item + entering/exiting en la sección de parcelas). LayoutAnimation de RN
    // es no-op con la New Architecture (Fabric), por eso se sentía abrupta.
    setExpandedPlantationId(prev => (prev === id ? null : id));
  }, []);

  const handleParcelaInlinePress = useCallback((plantacionId: string, parcelaId: string) => {
    router.push(`/${routePrefix}/plantation/${plantacionId}?parcelaId=${parcelaId}` as any);
  }, [router, routePrefix]);

  const handleParcelaInlineLongPress = useCallback((plantacionId: string, parcela: ParcelaWithStats) => {
    setEditingParcelaPlantacionId(plantacionId);
    setEditingParcela(parcela);
  }, []);

  const closeEditParcela = useCallback(() => {
    setEditingParcela(null);
    setEditingParcelaPlantacionId(null);
  }, []);

  // Admin modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configSpeciesPlantacionId, setConfigSpeciesPlantacionId] = useState<string | null>(null);
  const [assignTechPlantacionId, setAssignTechPlantacionId] = useState<string | null>(null);
  const [editingPlantation, setEditingPlantation] = useState<Plantation | null>(null);
  // Cuando se crea una plantación, encadenamos: selección de especies (tarea
  // atómica del alta, ui-ux §19) y al cerrarla navegamos al detalle para crear
  // subgrupos (issues #63 + #15). Guarda el id de la plantación a navegar.
  const [plantacionPendienteNav, setPlantacionPendienteNav] = useState<string | null>(null);

  async function handleCreatePlantation(lugar: string, periodo: string) {
    const id = await adminHook.handleCreateSubmit(lugar, periodo);
    setShowCreateModal(false);
    if (!id) return;
    // Abre la selección de especies de la plantación recién creada y agenda la
    // navegación al detalle para cuando se cierre esa pantalla.
    setConfigSpeciesPlantacionId(id);
    setPlantacionPendienteNav(id);
  }

  function handleCloseConfigSpecies() {
    setConfigSpeciesPlantacionId(null);
    if (!plantacionPendienteNav) return;
    const navId = plantacionPendienteNav;
    setPlantacionPendienteNav(null);
    router.push(`/${routePrefix}/plantation/${navId}` as any);
  }

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
    setEditingPlantation(item as Plantation);
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

  function handleBottomSheetSync() {
    if (bottomSheetPlantation) {
      setBottomSheetVisible(false);
      showSyncConfirm('plantation', bottomSheetPlantation.id);
    }
  }

  return (
    <TexturedBackground>
      <CustomHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        rightElement={
          <View style={styles.headerButtons}>
            {isOnline && (
              <HeaderActionButton
                icon="sync-outline"
                onPress={() => showSyncConfirm('global')}
                variant={hasAnyPending ? 'pending' : 'default'}
                disabled={isSyncing}
                accessibilityLabel="Sincronizar todas las plantaciones"
              />
            )}
            <HeaderActionButton
              icon="download-outline"
              onPress={() => { if (isOnline) router.push(`/${routePrefix}/plantation/catalog` as any); }}
              variant={isOnline ? 'default' : 'offline'}
              disabled={!isOnline}
              accessibilityLabel="Gestionar plantaciones descargadas"
            />
            {isAdmin && (
              <HeaderActionButton
                icon="add"
                onPress={() => setShowCreateModal(true)}
                accessibilityLabel="Nueva plantacion"
              />
            )}
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
              <Animated.View
                entering={FadeInDown.delay(index * 80).duration(300)}
                layout={LinearTransition.duration(220)}
                testID={`plantation-card-${item.id}`}
              >
                <ExpandablePlantationCard
                  plantacionId={item.id}
                  expanded={expandedPlantationId === item.id}
                  onToggleExpanded={() => handleToggleExpand(item.id)}
                  onParcelaPress={(parcelaId) => handleParcelaInlinePress(item.id, parcelaId)}
                  onParcelaLongPress={(p) => handleParcelaInlineLongPress(item.id, p)}
                  cardProps={{
                    lugar: item.lugar,
                    periodo: item.periodo,
                    totalCount: totalCountMap.get(item.id) ?? 0,
                    syncedCount: syncedCountMap.get(item.id) ?? 0,
                    todayCount: todayCountMap.get(item.id) ?? 0,
                    pendingSync: pendingSyncMap.get(item.id) ?? 0,
                    estado: item.estado,
                    hasPendingSync: (pendingSyncBoolMap.get(item.id) ?? 0) > 0,
                    nnCount: nnCountMap.get(item.id) ?? 0,
                    onPress: () => router.push(`/${routePrefix}/plantation/parcelas?plantacionId=${item.id}` as any),
                    onDelete: () => handleDeletePlantation(item.id),
                    isAdmin,
                    onEdit: () => handleEditPress(item),
                    onGear: () => handleOpenGear(item),
                  }}
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

      {editingParcela && editingParcelaPlantacionId && (
        <ParcelaFormModal
          visible
          mode="edit"
          plantacionId={editingParcelaPlantacionId}
          parcela={editingParcela}
          onClose={closeEditParcela}
        />
      )}

      <SyncConfirmModal
        visible={syncConfirmVisible}
        title={syncConfirmMode === 'global' ? 'Sincronizar todo' : 'Sincronizar plantacion'}
        onConfirm={handleSyncConfirm}
        onClose={() => setSyncConfirmVisible(false)}
      />

      <SyncProgressModal
        state={syncState}
        progress={progress}
        results={results}
        parcelaResults={parcelaResults}
        plantationResults={plantationResults}
        successCount={successCount}
        failureCount={failureCount}
        parcelaFailureCount={parcelaFailureCount}
        plantationFailureCount={plantationFailureCount}
        pullSuccess={pullSuccess}
        authExpired={authExpired}
        photoProgress={photoProgress}
        photoResult={photoResult}
        globalProgress={globalProgress}
        onDismiss={resetSync}
      />

      <ConfirmModal
        visible={syncState === 'done' && authExpired}
        icon="lock-closed"
        iconColor={colors.secondary}
        title="Sesion expirada"
        message="Tu sesion expiro. Inicia sesion de nuevo para sincronizar."
        buttons={[
          { label: 'Cancelar', style: 'cancel', onPress: resetSync },
          { label: 'Aceptar', style: 'primary', onPress: handleSessionExpiredReauth },
        ]}
        onDismiss={resetSync}
      />

      <AdminBottomSheet
        visible={bottomSheetVisible}
        plantation={bottomSheetPlantation}
        meta={bottomSheetMeta}
        isAdmin={isAdmin}
        isOnline={isOnline}
        onDismiss={() => setBottomSheetVisible(false)}
        onSync={handleBottomSheetSync}
        onConfigSpecies={() => handleBottomSheetAction(() => setConfigSpeciesPlantacionId(bottomSheetPlantation?.id ?? null))}
        onAssignTech={() => { if (bottomSheetPlantation) onAssignTechFromSheet(bottomSheetPlantation.id); }}
        onFinalize={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleFinalize(bottomSheetPlantation.id); })}
        onGenerateIds={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleGenerateIds(bottomSheetPlantation.id); })}
        onExportCsv={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleExportCsv(bottomSheetPlantation.id); })}
        onExportExcel={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleExportExcel(bottomSheetPlantation.id); })}
        onDiscardEdit={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleDiscardEdit(bottomSheetPlantation.id); })}
      />

      {isAdmin && (
        <AdminPlantationModals
          showCreateModal={showCreateModal}
          onCloseCreate={() => setShowCreateModal(false)}
          onCreateSubmit={handleCreatePlantation}
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
          onCloseConfigSpecies={handleCloseConfigSpecies}
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
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.textMuted },
  emptySubtext: { fontSize: fontSize.base, color: colors.textLight, fontFamily: fonts.regular },
  listContent: { padding: spacing.xxl, paddingTop: spacing['4xl'], paddingBottom: spacing['6xl'], gap: spacing.xl },
});
