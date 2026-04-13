/**
 * AdminPlantationModals — all modal dialogs for AdminScreen.
 * Extracted to keep AdminScreen under 350 lines.
 * Props-driven, no data access logic.
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import ConfirmModal from './ConfirmModal';
import PlantationFormModal from './PlantationFormModal';
import AdminModalWrapper from './AdminModalWrapper';
import ConfigureSpeciesScreen from '../screens/ConfigureSpeciesScreen';
import AssignTechniciansScreen from '../screens/AssignTechniciansScreen';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import type { Plantation } from './PlantationConfigCard';

type Props = {
  // Create modal
  showCreateModal: boolean;
  onCloseCreate: () => void;
  onCreateSubmit: (lugar: string, periodo: string) => Promise<void>;

  // Edit modal
  editingPlantation: Plantation | null;
  onCloseEdit: () => void;
  onEditSubmit: (lugar: string, periodo: string) => Promise<void>;

  // Confirm modal
  confirmProps: any;

  // Seed dialog
  seedModalPlantacionId: string | null;
  seedValue: string;
  setSeedValue: (v: string) => void;
  seedLoading: boolean;
  onCloseSeed: () => void;
  onConfirmSeed: () => void;

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
  seedModalPlantacionId,
  seedValue,
  setSeedValue,
  seedLoading,
  onCloseSeed,
  onConfirmSeed,
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

      <Modal
        visible={!!seedModalPlantacionId}
        transparent
        animationType="fade"
        onRequestClose={onCloseSeed}
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
                onPress={onCloseSeed}
                disabled={seedLoading}
              >
                <Text style={styles.seedBtnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.seedBtn,
                  styles.seedBtnPrimary,
                  pressed && { opacity: 0.8 },
                  seedLoading && { opacity: 0.6 },
                ]}
                onPress={onConfirmSeed}
                disabled={seedLoading}
              >
                {seedLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.seedBtnPrimaryText}>Generar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

const styles = StyleSheet.create({
  seedOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
  },
  seedCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xxl,
    padding: spacing['4xl'],
    gap: spacing.xl,
  },
  seedTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  seedLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
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
    marginTop: spacing.md,
  },
  seedBtn: {
    flex: 1,
    flexDirection: 'row',
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
    fontFamily: fonts.semiBold,
  },
  seedBtnPrimary: { backgroundColor: colors.primary },
  seedBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  exportOverlayText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontFamily: fonts.semiBold,
  },
});
