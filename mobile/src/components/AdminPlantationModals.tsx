/**
 * AdminPlantationModals — all modal dialogs for AdminScreen.
 * Extracted to keep AdminScreen under 350 lines.
 * Props-driven, no data access logic.
 */
import React from 'react';
import { View, Text, Modal, ActivityIndicator } from 'react-native';
import ConfirmModal from './ConfirmModal';
import PlantationFormModal from './PlantationFormModal';
import AdminModalWrapper from './AdminModalWrapper';
import ConfigureSpeciesScreen from '../screens/ConfigureSpeciesScreen';
import AssignTechniciansScreen from '../screens/AssignTechniciansScreen';
import { colors } from '../theme';
import { adminPlantationModalsStyles as styles } from './AdminPlantationModals.styles';
import type { Plantation } from './PlantationConfigCard';
import type { PlantationGpsSettings } from '../repositories/PlantationRepository';

type Props = {
  // Create modal
  showCreateModal: boolean;
  onCloseCreate: () => void;
  onCreateSubmit: (lugar: string, periodo: string, gps: PlantationGpsSettings) => Promise<void>;

  // Edit modal
  editingPlantation: Plantation | null;
  onCloseEdit: () => void;
  onEditSubmit: (lugar: string, periodo: string, gps: PlantationGpsSettings) => Promise<void>;

  // Confirm modal
  confirmProps: any;

  // Export loading
  exportingId: string | null;

  // Configure species modal
  configSpeciesPlantacionId: string | null;
  onCloseConfigSpecies: () => void;
  pendingSyncForSpecies?: boolean;

  // Assign technicians modal
  assignTechPlantacionId: string | null;
  onCloseAssignTech: () => void;
};

export default function AdminPlantationModals({
  showCreateModal,
  onCloseCreate,
  onCreateSubmit,
  editingPlantation,
  onCloseEdit,
  onEditSubmit,
  confirmProps,
  exportingId,
  configSpeciesPlantacionId,
  onCloseConfigSpecies,
  pendingSyncForSpecies,
  assignTechPlantacionId,
  onCloseAssignTech,
}: Props) {
  return (
    <>
      <PlantationFormModal
        visible={showCreateModal}
        onClose={onCloseCreate}
        onSubmit={onCreateSubmit}
      />

      <PlantationFormModal
        visible={editingPlantation !== null}
        onClose={onCloseEdit}
        onSubmit={onEditSubmit}
        editingPlantation={editingPlantation}
      />

      <ConfirmModal {...confirmProps} />

      {exportingId && (
        <View style={styles.exportOverlay}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.exportOverlayText}>Exportando...</Text>
        </View>
      )}

      <Modal
        visible={configSpeciesPlantacionId !== null}
        animationType="slide"
        onRequestClose={onCloseConfigSpecies}
      >
        <AdminModalWrapper
          title="Configurar especies"
          onClose={onCloseConfigSpecies}
        >
          {configSpeciesPlantacionId && (
            <ConfigureSpeciesScreen
              plantacionIdProp={configSpeciesPlantacionId}
              onClose={onCloseConfigSpecies}
              pendingSync={pendingSyncForSpecies}
            />
          )}
        </AdminModalWrapper>
      </Modal>

      <Modal
        visible={assignTechPlantacionId !== null}
        animationType="slide"
        onRequestClose={onCloseAssignTech}
      >
        <AdminModalWrapper
          title="Asignar técnicos"
          onClose={onCloseAssignTech}
        >
          {assignTechPlantacionId && (
            <AssignTechniciansScreen
              plantacionIdProp={assignTechPlantacionId}
              onClose={onCloseAssignTech}
            />
          )}
        </AdminModalWrapper>
      </Modal>
    </>
  );
}
