/**
 * AdminScreen — plantation management for admins.
 *
 * Shows all plantations with estado chip and action buttons.
 * Allows creating new plantations (lugar + periodo form).
 * Provides navigation to species config and technician assignment.
 * Handles finalization with gate check (all subgroups must be sincronizada).
 *
 * Covers requirements: PLAN-01, PLAN-02, PLAN-03, PLAN-06
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, fontSize, spacing, borderRadius } from '../theme';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import ConfirmModal from '../components/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { getPlantationsForRole } from '../queries/dashboardQueries';
import { checkFinalizationGate, getMaxGlobalId } from '../queries/adminQueries';
import { createPlantation, updatePlantation, finalizePlantation, generateIds } from '../repositories/PlantationRepository';
import { exportToCSV, exportToExcel } from '../services/ExportService';

import AdminModalWrapper from '../components/AdminModalWrapper';
import PlantationCard from '../components/PlantationCard';
import type { Plantation } from '../components/PlantationCard';
import PlantationFormModal from '../components/PlantationFormModal';
import ConfigureSpeciesScreen from './ConfigureSpeciesScreen';
import AssignTechniciansScreen from './AssignTechniciansScreen';

// ─── AdminScreen ──────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const userId = useCurrentUserId();

  const [organizacionId, setOrganizacionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const { confirmProps, show: showConfirm } = useConfirm();

  // Seed dialog state
  const [seedModalPlantacionId, setSeedModalPlantacionId] = useState<string | null>(null);
  const [seedValue, setSeedValue] = useState('');
  const [seedLoading, setSeedLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Modal states for admin sub-screens
  const [configSpeciesPlantacionId, setConfigSpeciesPlantacionId] = useState<string | null>(null);
  const [assignTechPlantacionId, setAssignTechPlantacionId] = useState<string | null>(null);

  // Edit plantation modal state
  const [editingPlantation, setEditingPlantation] = useState<Plantation | null>(null);

  // Fetch organizacionId from profiles on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data?.user?.id) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('organizacion_id')
          .eq('id', data.user.id)
          .single();
        if (profile?.organizacion_id) {
          setOrganizacionId(profile.organizacion_id);
        }
      })
      .catch(console.error);
  }, []);

  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(true, userId),
    [userId]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleFinalize(plantacionId: string) {
    if (finalizing) return;
    setFinalizing(true);
    try {
      const gate = await checkFinalizationGate(plantacionId);
      if (gate.canFinalize) {
        showConfirm({
          icon: 'warning-outline',
          iconColor: colors.stateFinalizada,
          title: 'Finalizar plantacion',
          message:
            'Esta accion no se puede deshacer. La plantacion quedara bloqueada y no se podran agregar nuevos subgrupos.',
          buttons: [
            { label: 'Cancelar', style: 'cancel', onPress: () => {} },
            {
              label: 'Finalizar',
              style: 'danger',
              icon: 'lock-closed-outline',
              onPress: async () => {
                try {
                  await finalizePlantation(plantacionId);
                } catch (e: any) {
                  showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo finalizar la plantacion.', 'alert-circle-outline', colors.danger);
                }
              },
            },
          ],
        });
      } else {
        const blockingNames = gate.blocking.map((b) => `\u2022 ${b.nombre} (${b.estado})`).join('\n');
        showConfirm({
          icon: 'close-circle-outline',
          iconColor: colors.danger,
          title: 'No se puede finalizar',
          message: `Los siguientes subgrupos no estan sincronizados:\n\n${blockingNames}`,
          buttons: [{ label: 'Entendido', style: 'primary', onPress: () => {} }],
        });
      }
    } catch (e: any) {
      showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo verificar el estado.', 'alert-circle-outline', colors.danger);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleGenerateIds(plantacionId: string) {
    try {
      const maxId = await getMaxGlobalId();
      const suggested = (maxId + 1).toString();
      setSeedValue(suggested);
      setSeedModalPlantacionId(plantacionId);
    } catch (e: any) {
      showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo obtener el ID sugerido.', 'alert-circle-outline', colors.danger);
    }
  }

  async function confirmSeedAndGenerate() {
    if (!seedModalPlantacionId) return;
    const seed = parseInt(seedValue, 10);
    if (isNaN(seed) || seed < 1) {
      showInfoDialog(showConfirm, 'Semilla invalida', 'Ingresa un numero entero mayor a 0.', 'alert-circle-outline', colors.secondary);
      return;
    }
    const pid = seedModalPlantacionId;
    setSeedModalPlantacionId(null);
    showConfirm({
      icon: 'key-outline',
      iconColor: colors.primary,
      title: 'Generar IDs',
      message: 'Se van a generar IDs para todos los arboles de esta plantacion. Esta accion no se puede deshacer.',
      buttons: [
        { label: 'Cancelar', style: 'cancel', onPress: () => {} },
        {
          label: 'Generar',
          style: 'primary',
          icon: 'key-outline',
          onPress: async () => {
            setSeedLoading(true);
            try {
              await generateIds(pid, seed);
            } catch (e: any) {
              showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudieron generar los IDs.', 'alert-circle-outline', colors.danger);
            } finally {
              setSeedLoading(false);
            }
          },
        },
      ],
    });
  }

  async function handleExportCsv(plantacionId: string) {
    const plantation = (plantationList as Plantation[] | null)?.find((p) => p.id === plantacionId);
    if (!plantation) return;
    setExportingId(plantacionId + '_csv');
    try {
      await exportToCSV(plantacionId, plantation.lugar);
    } catch (e: any) {
      showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo exportar el CSV.', 'alert-circle-outline', colors.danger);
    } finally {
      setExportingId(null);
    }
  }

  async function handleExportExcel(plantacionId: string) {
    const plantation = (plantationList as Plantation[] | null)?.find((p) => p.id === plantacionId);
    if (!plantation) return;
    setExportingId(plantacionId + '_xlsx');
    try {
      await exportToExcel(plantacionId, plantation.lugar);
    } catch (e: any) {
      showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo exportar el Excel.', 'alert-circle-outline', colors.danger);
    } finally {
      setExportingId(null);
    }
  }

  async function handleCreateSubmit(lugar: string, periodo: string) {
    if (!organizacionId || !userId) {
      throw new Error('No se pudo obtener datos del usuario. Intente de nuevo.');
    }
    await createPlantation(lugar, periodo, organizacionId, userId);
    setShowCreateModal(false);
  }

  async function handleEditSubmit(lugar: string, periodo: string) {
    if (!editingPlantation) return;
    await updatePlantation(editingPlantation.id, lugar, periodo);
    setEditingPlantation(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>Gestion de plantaciones</Text>
      </View>

      {/* Plantation list */}
      {!plantationList || plantationList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No hay plantaciones</Text>
          <Text style={styles.emptySubtext}>Crea una plantacion para comenzar</Text>
        </View>
      ) : (
        <FlatList
          data={plantationList as Plantation[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PlantationCard
              item={item}
              onFinalize={handleFinalize}
              onGenerateIds={handleGenerateIds}
              onExportCsv={handleExportCsv}
              onExportExcel={handleExportExcel}
              onConfigSpecies={(id) => setConfigSpeciesPlantacionId(id)}
              onAssignTech={(id) => setAssignTechPlantacionId(id)}
              onEdit={(p) => setEditingPlantation(p)}
            />
          )}
        />
      )}

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.8 }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.createButtonText}>Crear plantacion</Text>
        </Pressable>
      </View>

      {/* Create plantation modal */}
      <PlantationFormModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
      />

      {/* Edit plantation modal */}
      <PlantationFormModal
        visible={editingPlantation !== null}
        onClose={() => setEditingPlantation(null)}
        onSubmit={handleEditSubmit}
        editingPlantation={editingPlantation}
      />

      {/* Confirm modal */}
      <ConfirmModal {...confirmProps} />

      {/* Seed dialog for ID generation */}
      <Modal
        visible={!!seedModalPlantacionId}
        transparent
        animationType="fade"
        onRequestClose={() => setSeedModalPlantacionId(null)}
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
                style={({ pressed }) => [
                  styles.seedBtn,
                  styles.seedBtnCancel,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setSeedModalPlantacionId(null)}
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
                onPress={confirmSeedAndGenerate}
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

      {/* Export loading overlay */}
      {exportingId && (
        <View style={styles.exportOverlay}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.exportOverlayText}>Exportando...</Text>
        </View>
      )}

      {/* Configure Species modal */}
      <Modal
        visible={configSpeciesPlantacionId !== null}
        animationType="slide"
        onRequestClose={() => setConfigSpeciesPlantacionId(null)}
      >
        <AdminModalWrapper
          title="Configurar especies"
          onClose={() => setConfigSpeciesPlantacionId(null)}
        >
          {configSpeciesPlantacionId && (
            <ConfigureSpeciesScreen
              plantacionIdProp={configSpeciesPlantacionId}
              onClose={() => setConfigSpeciesPlantacionId(null)}
            />
          )}
        </AdminModalWrapper>
      </Modal>

      {/* Assign Technicians modal */}
      <Modal
        visible={assignTechPlantacionId !== null}
        animationType="slide"
        onRequestClose={() => setAssignTechPlantacionId(null)}
      >
        <AdminModalWrapper
          title="Asignar tecnicos"
          onClose={() => setAssignTechPlantacionId(null)}
        >
          {assignTechPlantacionId && (
            <AssignTechniciansScreen
              plantacionIdProp={assignTechPlantacionId}
              onClose={() => setAssignTechPlantacionId(null)}
            />
          )}
        </AdminModalWrapper>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSize.title,
    fontWeight: 'bold',
  },
  bottomBar: {
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  createButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.textMuted,
  },
  emptySubtext: {
    fontSize: fontSize.base,
    color: colors.textLight,
  },
  listContent: {
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  // ─── Seed dialog ──────────────────────────────────────────────────────────
  seedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  seedLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  seedBtnPrimary: {
    backgroundColor: colors.primary,
  },
  seedBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  // ─── Export overlay ───────────────────────────────────────────────────────
  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  exportOverlayText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: '600',
  },
});
