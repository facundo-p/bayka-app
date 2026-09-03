/**
 * usePlantacionesScreen — state and handlers for PlantacionesScreen.
 *
 * Composes the data hooks (usePlantaciones, usePlantationAdmin, useSync,
 * useAuth, usePendingSyncCount/Map) and owns the screen-local UI state:
 * sync confirm dialog, admin bottom sheet, inline parcela expand/edit, and
 * the admin create/edit/config-species/assign-tech modals. No SQL/db
 * imports here — only calls into existing hooks/repositories/services.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useRoutePrefix } from './useRoutePrefix';
import { usePlantaciones } from './usePlantaciones';
import { usePlantationAdmin, fetchPlantationMeta } from './usePlantationAdmin';
import { useSync } from './useSync';
import { useAuth } from './useAuth';
import { usePendingSyncCount } from './usePendingSyncCount';
import { usePendingSyncMap } from './usePendingSyncMap';
import type { ExpandedMeta } from './usePlantationAdmin';
import type { Plantation } from '../components/PlantationConfigCard';
import type { ParcelaWithStats } from '../queries/parcelaQueries';
import type { Parcela } from '../repositories/ParcelaRepository';
import type { PlantationGpsSettings } from '../repositories/PlantationRepository';

const EMPTY_META: ExpandedMeta = { canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0 };

export function usePlantacionesScreen() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();

  const plantaciones = usePlantaciones();
  // Always call the hook (React rules of hooks), even for técnico role.
  const adminHook = usePlantationAdmin();
  const sync = useSync();
  const { signOut } = useAuth();
  const { pendingCount: globalPendingCount } = usePendingSyncCount();
  const pendingSyncBoolMap = usePendingSyncMap();

  const hasAnyPending = globalPendingCount > 0;
  const isSyncing = sync.state !== 'idle' && sync.state !== 'done';

  // Sesión expirada durante el sync: "Aceptar" cierra sesión (el root layout
  // redirige a login); "Cancelar" solo descarta el aviso.
  const handleSessionExpiredReauth = useCallback(() => {
    sync.reset();
    signOut();
  }, [sync, signOut]);

  // ─── Sync confirm dialog (global o por plantación) ───────────────────────
  const [syncConfirmVisible, setSyncConfirmVisible] = useState(false);
  const [syncConfirmMode, setSyncConfirmMode] = useState<'global' | 'plantation'>('global');
  const [syncTargetPlantationId, setSyncTargetPlantationId] = useState<string | null>(null);

  const showSyncConfirm = useCallback((mode: 'global' | 'plantation', plantationId?: string) => {
    setSyncConfirmMode(mode);
    setSyncTargetPlantationId(plantationId ?? null);
    setSyncConfirmVisible(true);
  }, []);

  const closeSyncConfirm = useCallback(() => setSyncConfirmVisible(false), []);

  const handleSyncConfirm = useCallback((incluirFotos: boolean) => {
    setSyncConfirmVisible(false);
    if (syncConfirmMode === 'global') {
      sync.startGlobalSync(incluirFotos);
    } else if (syncTargetPlantationId) {
      sync.startPlantationSync(syncTargetPlantationId, incluirFotos);
    }
  }, [sync, syncConfirmMode, syncTargetPlantationId]);

  // ─── Admin bottom sheet (gear menu) ───────────────────────────────────────
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetPlantation, setBottomSheetPlantation] = useState<Plantation | null>(null);
  const [bottomSheetMeta, setBottomSheetMeta] = useState<ExpandedMeta>(EMPTY_META);

  const handleOpenGear = useCallback(async (plantation: Plantation) => {
    setBottomSheetPlantation(plantation);
    const meta = await fetchPlantationMeta(plantation);
    setBottomSheetMeta(meta);
    setBottomSheetVisible(true);
  }, []);

  const closeBottomSheet = useCallback(() => setBottomSheetVisible(false), []);

  const handleBottomSheetAction = useCallback((action: () => void | Promise<void>) => {
    setBottomSheetVisible(false);
    action();
  }, []);

  const onAssignTechFromSheet = useCallback(async (plantacionId: string) => {
    setBottomSheetVisible(false);
    const ok = await adminHook.handleAssignTech(plantacionId);
    if (ok) setAssignTechPlantacionId(plantacionId);
  }, [adminHook]);

  // ─── Single-card expansion + inline parcela edit modal ────────────────────
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

  // ─── Admin: create / edit / config species / assign tech ─────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configSpeciesPlantacionId, setConfigSpeciesPlantacionId] = useState<string | null>(null);
  const [assignTechPlantacionId, setAssignTechPlantacionId] = useState<string | null>(null);
  const [editingPlantation, setEditingPlantation] = useState<Plantation | null>(null);
  // Cuando se crea una plantación, encadenamos: selección de especies (tarea
  // atómica del alta) y al cerrarla navegamos al detalle para crear subgrupos
  // (issues #63 + #15). Guarda el id de la plantación a navegar.
  const [plantacionPendienteNav, setPlantacionPendienteNav] = useState<string | null>(null);

  const handleCreatePlantation = useCallback(async (lugar: string, periodo: string, gps: PlantationGpsSettings) => {
    const id = await adminHook.handleCreateSubmit(lugar, periodo, gps);
    setShowCreateModal(false);
    if (!id) return;
    // Abre la selección de especies de la plantación recién creada y agenda la
    // navegación al detalle para cuando se cierre esa pantalla.
    setConfigSpeciesPlantacionId(id);
    setPlantacionPendienteNav(id);
  }, [adminHook]);

  const handleCloseConfigSpecies = useCallback(() => {
    setConfigSpeciesPlantacionId(null);
    if (!plantacionPendienteNav) return;
    const navId = plantacionPendienteNav;
    setPlantacionPendienteNav(null);
    router.push(`/${routePrefix}/plantation/${navId}` as any);
  }, [plantacionPendienteNav, router, routePrefix]);

  const handleEditPress = useCallback((plantation: Plantation) => {
    setEditingPlantation(plantation);
  }, []);

  const pendingSyncForSpecies = adminHook.plantationList?.find(p => p.id === configSpeciesPlantacionId)?.pendingSync;

  return {
    router,
    routePrefix,
    ...plantaciones,
    adminHook,

    // Sync
    syncState: sync.state,
    startGlobalSync: sync.startGlobalSync,
    startPlantationSync: sync.startPlantationSync,
    globalProgress: sync.globalProgress,
    progress: sync.progress,
    results: sync.results,
    parcelaResults: sync.parcelaResults,
    plantationResults: sync.plantationResults,
    resetSync: sync.reset,
    pullSuccess: sync.pullSuccess,
    authExpired: sync.authExpired,
    successCount: sync.successCount,
    failureCount: sync.failureCount,
    parcelaFailureCount: sync.parcelaFailureCount,
    plantationFailureCount: sync.plantationFailureCount,
    photoProgress: sync.photoProgress,
    photoResult: sync.photoResult,
    handleSessionExpiredReauth,
    hasAnyPending,
    isSyncing,
    pendingSyncBoolMap,

    // Sync confirm dialog
    syncConfirmVisible,
    syncConfirmMode,
    syncTargetPlantationId,
    showSyncConfirm,
    closeSyncConfirm,
    handleSyncConfirm,

    // Admin bottom sheet
    bottomSheetVisible,
    bottomSheetPlantation,
    bottomSheetMeta,
    handleOpenGear,
    closeBottomSheet,
    handleBottomSheetAction,
    onAssignTechFromSheet,

    // Expand + inline parcela edit
    expandedPlantationId,
    handleToggleExpand,
    handleParcelaInlinePress,
    handleParcelaInlineLongPress,
    editingParcela,
    editingParcelaPlantacionId,
    closeEditParcela,

    // Admin create/edit/config-species/assign-tech modals
    showCreateModal,
    setShowCreateModal,
    handleCreatePlantation,
    editingPlantation,
    setEditingPlantation,
    handleEditPress,
    configSpeciesPlantacionId,
    setConfigSpeciesPlantacionId,
    handleCloseConfigSpecies,
    pendingSyncForSpecies,
    assignTechPlantacionId,
    setAssignTechPlantacionId,
  };
}
