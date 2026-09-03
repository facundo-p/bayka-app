/**
 * PlantacionesModals — every modal/dialog rendered by PlantacionesScreen.
 * Purely props-driven, no data access logic.
 */
import { colors } from '../theme';
import ConfirmModal from './ConfirmModal';
import ParcelaFormModal from './ParcelaFormModal';
import AdminBottomSheet from './AdminBottomSheet';
import AdminPlantationModals from './AdminPlantationModals';
import SyncProgressModal from './SyncProgressModal';
import SyncConfirmModal from './SyncConfirmModal';
import type { ExpandedMeta } from '../hooks/usePlantationAdmin';
import type { Plantation } from './PlantationConfigCard';
import type { Parcela } from '../repositories/ParcelaRepository';
import type { SyncState } from '../hooks/useSync';
import type { SyncProgress, SyncGroupResult, SyncParcelaResult, SyncPlantationResult, PhotoSyncProgress } from '../services/SyncService';

type GlobalSyncProgress = { plantationName: string; done: number; total: number } | null;

type AdminHook = {
  plantationList: Plantation[] | null;
  confirmProps: any;
  exportingId: string | null;
  handleFinalize: (id: string) => void | Promise<void>;
  handleExportCsv: (id: string) => void | Promise<void>;
  handleExportExcel: (id: string) => void | Promise<void>;
  handleExportKml: (id: string) => void | Promise<void>;
  handleDiscardEdit: (id: string) => void | Promise<void>;
  handleEditSubmit: (id: string, lugar: string, periodo: string, gps: any) => Promise<void>;
};

type Props = {
  isAdmin: boolean;
  adminHook: AdminHook;

  // Delete confirm (usePlantaciones)
  confirmProps: any;

  // Inline parcela edit
  editingParcela: Parcela | null;
  editingParcelaPlantacionId: string | null;
  closeEditParcela: () => void;

  // Sync confirm dialog
  syncConfirmVisible: boolean;
  syncConfirmMode: 'global' | 'plantation';
  syncTargetPlantationId: string | null;
  handleSyncConfirm: (incluirFotos: boolean) => void;
  closeSyncConfirm: () => void;

  // Sync progress
  syncState: SyncState;
  progress: SyncProgress | null;
  results: SyncGroupResult[];
  parcelaResults: SyncParcelaResult[];
  plantationResults: SyncPlantationResult[];
  successCount: number;
  failureCount: number;
  parcelaFailureCount: number;
  plantationFailureCount: number;
  pullSuccess: boolean | null;
  authExpired: boolean;
  photoProgress: PhotoSyncProgress | null;
  photoResult: { uploaded?: number; uploadFailed?: number; downloaded?: number; downloadFailed?: number } | null;
  globalProgress: GlobalSyncProgress;
  resetSync: () => void;
  handleSessionExpiredReauth: () => void;

  // Admin bottom sheet
  bottomSheetVisible: boolean;
  bottomSheetPlantation: Plantation | null;
  bottomSheetMeta: ExpandedMeta;
  closeBottomSheet: () => void;
  handleBottomSheetAction: (action: () => void | Promise<void>) => void;
  onAssignTechFromSheet: (plantacionId: string) => void;
  handleEditPress: (plantation: Plantation) => void;

  // Admin create/edit/config-species/assign-tech modals
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  handleCreatePlantation: (lugar: string, periodo: string, gps: any) => Promise<void>;
  editingPlantation: Plantation | null;
  setEditingPlantation: (p: Plantation | null) => void;
  configSpeciesPlantacionId: string | null;
  setConfigSpeciesPlantacionId: (id: string | null) => void;
  handleCloseConfigSpecies: () => void;
  pendingSyncForSpecies?: boolean;
  assignTechPlantacionId: string | null;
  setAssignTechPlantacionId: (id: string | null) => void;
};

export default function PlantacionesModals({
  isAdmin,
  adminHook,
  confirmProps,
  editingParcela,
  editingParcelaPlantacionId,
  closeEditParcela,
  syncConfirmVisible,
  syncConfirmMode,
  syncTargetPlantationId,
  handleSyncConfirm,
  closeSyncConfirm,
  syncState,
  progress,
  results,
  parcelaResults,
  plantationResults,
  successCount,
  failureCount,
  parcelaFailureCount,
  plantationFailureCount,
  pullSuccess,
  authExpired,
  photoProgress,
  photoResult,
  globalProgress,
  resetSync,
  handleSessionExpiredReauth,
  bottomSheetVisible,
  bottomSheetPlantation,
  bottomSheetMeta,
  closeBottomSheet,
  handleBottomSheetAction,
  onAssignTechFromSheet,
  handleEditPress,
  showCreateModal,
  setShowCreateModal,
  handleCreatePlantation,
  editingPlantation,
  setEditingPlantation,
  configSpeciesPlantacionId,
  setConfigSpeciesPlantacionId,
  handleCloseConfigSpecies,
  pendingSyncForSpecies,
  assignTechPlantacionId,
  setAssignTechPlantacionId,
}: Props) {
  return (
    <>
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
        plantacionId={syncConfirmMode === 'plantation' ? syncTargetPlantationId ?? undefined : undefined}
        onConfirm={handleSyncConfirm}
        onClose={closeSyncConfirm}
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
        onDismiss={closeBottomSheet}
        onEdit={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) handleEditPress(bottomSheetPlantation); })}
        onConfigSpecies={() => handleBottomSheetAction(() => setConfigSpeciesPlantacionId(bottomSheetPlantation?.id ?? null))}
        onAssignTech={() => { if (bottomSheetPlantation) onAssignTechFromSheet(bottomSheetPlantation.id); }}
        onFinalize={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleFinalize(bottomSheetPlantation.id); })}
        onExportCsv={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleExportCsv(bottomSheetPlantation.id); })}
        onExportExcel={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleExportExcel(bottomSheetPlantation.id); })}
        onExportKml={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleExportKml(bottomSheetPlantation.id); })}
        onDiscardEdit={() => handleBottomSheetAction(() => { if (bottomSheetPlantation) adminHook.handleDiscardEdit(bottomSheetPlantation.id); })}
      />

      {isAdmin && (
        <AdminPlantationModals
          showCreateModal={showCreateModal}
          onCloseCreate={() => setShowCreateModal(false)}
          onCreateSubmit={handleCreatePlantation}
          editingPlantation={editingPlantation}
          onCloseEdit={() => setEditingPlantation(null)}
          onEditSubmit={async (lugar, periodo, gps) => { if (editingPlantation) { await adminHook.handleEditSubmit(editingPlantation.id, lugar, periodo, gps); setEditingPlantation(null); } }}
          confirmProps={adminHook.confirmProps}
          exportingId={adminHook.exportingId}
          configSpeciesPlantacionId={configSpeciesPlantacionId}
          onCloseConfigSpecies={handleCloseConfigSpecies}
          pendingSyncForSpecies={(adminHook.plantationList as Plantation[] | null)?.find(p => p.id === configSpeciesPlantacionId)?.pendingSync}
          assignTechPlantacionId={assignTechPlantacionId}
          onCloseAssignTech={() => setAssignTechPlantacionId(null)}
        />
      )}
    </>
  );
}
