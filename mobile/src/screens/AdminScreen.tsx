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
import { useRouter } from 'expo-router';
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
import { checkFinalizationGate, getMaxGlobalId, hasIdsGenerated } from '../queries/adminQueries';
import { createPlantation, finalizePlantation, generateIds } from '../repositories/PlantationRepository';
import { exportToCSV, exportToExcel } from '../services/ExportService';
import ConfigureSpeciesScreen from './ConfigureSpeciesScreen';
import AssignTechniciansScreen from './AssignTechniciansScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Plantation = {
  id: string;
  lugar: string;
  periodo: string;
  estado: string;
  createdAt: string;
};

// ─── Estado Chip ──────────────────────────────────────────────────────────────

function EstadoChip({ estado }: { estado: string }) {
  const chipColor =
    estado === 'activa'
      ? colors.stateActiva
      : estado === 'finalizada'
      ? colors.stateFinalizada
      : colors.stateSincronizada;

  const label =
    estado === 'activa' ? 'Activa' : estado === 'finalizada' ? 'Finalizada' : estado;

  return (
    <View style={[styles.chip, { backgroundColor: chipColor + '22', borderColor: chipColor }]}>
      <Text style={[styles.chipText, { color: chipColor }]}>{label}</Text>
    </View>
  );
}

// ─── Create Plantation Modal ──────────────────────────────────────────────────

type CreateModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  organizacionId: string | null;
  userId: string | null;
};

function CreatePlantationModal({
  visible,
  onClose,
  onCreated,
  organizacionId,
  userId,
}: CreateModalProps) {
  const [lugar, setLugar] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLugar('');
    setPeriodo('');
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    if (lugar.trim().length < 2) {
      setError('Lugar debe tener al menos 2 caracteres.');
      return;
    }
    if (periodo.trim().length < 2) {
      setError('Periodo debe tener al menos 2 caracteres.');
      return;
    }
    if (!organizacionId || !userId) {
      setError('No se pudo obtener datos del usuario. Intente de nuevo.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createPlantation(lugar.trim(), periodo.trim(), organizacionId, userId);
      reset();
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear la plantacion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Nueva plantacion</Text>

          <Text style={styles.inputLabel}>Lugar</Text>
          <TextInput
            style={styles.textInput}
            value={lugar}
            onChangeText={setLugar}
            placeholder="Ej: Finca Los Alamos"
            placeholderTextColor={colors.textPlaceholder}
            editable={!loading}
          />

          <Text style={styles.inputLabel}>Periodo</Text>
          <TextInput
            style={styles.textInput}
            value={periodo}
            onChangeText={setPeriodo}
            placeholder="Ej: 2026-Otono"
            placeholderTextColor={colors.textPlaceholder}
            editable={!loading}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnCancel,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnPrimary,
                pressed && { opacity: 0.8 },
                loading && { opacity: 0.6 },
              ]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalBtnPrimaryText}>Crear</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Plantation Card ──────────────────────────────────────────────────────────

type PlantationCardProps = {
  item: Plantation;
  onFinalize: (id: string) => void;
  onGenerateIds: (id: string) => void;
  onExportCsv: (id: string) => void;
  onExportExcel: (id: string) => void;
  onConfigSpecies: (id: string) => void;
  onAssignTech: (id: string) => void;
};

function PlantationCard({
  item,
  onFinalize,
  onGenerateIds,
  onExportCsv,
  onExportExcel,
  onConfigSpecies,
  onAssignTech,
}: PlantationCardProps) {
  const router = useRouter();
  const [idsGenerated, setIdsGenerated] = useState(false);

  useEffect(() => {
    if (item.estado === 'finalizada') {
      hasIdsGenerated(item.id).then(setIdsGenerated).catch(console.error);
    }
  }, [item.id, item.estado]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleArea}>
          <Text style={styles.cardTitle}>{item.lugar}</Text>
          <Text style={styles.cardSubtitle}>{item.periodo}</Text>
        </View>
        <EstadoChip estado={item.estado} />
      </View>

      {item.estado === 'activa' && (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && { opacity: 0.7 }]}
            onPress={() => onConfigSpecies(item.id)}
          >
            <Ionicons name="list-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>Configurar especies</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && { opacity: 0.7 }]}
            onPress={() => onAssignTech(item.id)}
          >
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>Asignar tecnicos</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnDanger, pressed && { opacity: 0.7 }]}
            onPress={() => onFinalize(item.id)}
          >
            <Ionicons name="lock-closed-outline" size={14} color={colors.white} />
            <Text style={styles.actionBtnDangerText}>Finalizar</Text>
          </Pressable>
        </View>
      )}

      {item.estado === 'finalizada' && (
        <View style={styles.actionRow}>
          {!idsGenerated && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnPrimary, pressed && { opacity: 0.7 }]}
              onPress={() => onGenerateIds(item.id)}
            >
              <Ionicons name="key-outline" size={14} color={colors.white} />
              <Text style={styles.actionBtnPrimaryText}>Generar IDs</Text>
            </Pressable>
          )}
          {idsGenerated && (
            <>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && { opacity: 0.7 }]}
                onPress={() => onExportCsv(item.id)}
              >
                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>Exportar CSV</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && { opacity: 0.7 }]}
                onPress={() => onExportExcel(item.id)}
              >
                <Ionicons name="grid-outline" size={14} color={colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>Exportar Excel</Text>
              </Pressable>
            </>
          )}
          <View style={styles.lockedBadge}>
            <Ionicons name="lock-closed" size={12} color={colors.stateFinalizada} />
            <Text style={styles.lockedText}>Bloqueada</Text>
          </View>
        </View>
      )}
    </View>
  );
}

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
            {
              label: 'Cancelar',
              style: 'cancel',
              onPress: () => {},
            },
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
        const blockingNames = gate.blocking.map((b) => `• ${b.nombre} (${b.estado})`).join('\n');
        showConfirm({
          icon: 'close-circle-outline',
          iconColor: colors.danger,
          title: 'No se puede finalizar',
          message: `Los siguientes subgrupos no estan sincronizados:\n\n${blockingNames}`,
          buttons: [
            {
              label: 'Entendido',
              style: 'primary',
              onPress: () => {},
            },
          ],
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
    setSeedModalPlantacionId(null);
    const pid = seedModalPlantacionId;
    showConfirm({
      icon: 'key-outline',
      iconColor: colors.primary,
      title: 'Generar IDs',
      message: 'Se van a generar IDs para todos los arboles de esta plantacion. Esta accion no se puede deshacer.',
      buttons: [
        {
          label: 'Cancelar',
          style: 'cancel',
          onPress: () => {},
        },
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>Gestion de plantaciones</Text>
        <Pressable
          style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.8 }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.createButtonText}>Crear plantacion</Text>
        </Pressable>
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
            />
          )}
        />
      )}

      {/* Create plantation modal */}
      <CreatePlantationModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => setShowCreateModal(false)}
        organizacionId={organizacionId}
        userId={userId}
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.seedModalCard]}>
            <Text style={styles.modalTitle}>Semilla para ID Global</Text>
            <Text style={styles.inputLabel}>Valor inicial del ID Global</Text>
            <TextInput
              style={styles.textInput}
              value={seedValue}
              onChangeText={setSeedValue}
              keyboardType="number-pad"
              placeholder="Ej: 1001"
              placeholderTextColor={colors.textPlaceholder}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnCancel,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setSeedModalPlantacionId(null)}
                disabled={seedLoading}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  pressed && { opacity: 0.8 },
                  seedLoading && { opacity: 0.6 },
                ]}
                onPress={confirmSeedAndGenerate}
                disabled={seedLoading}
              >
                {seedLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Generar</Text>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setConfigSpeciesPlantacionId(null)} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Configurar especies</Text>
          </View>
          {configSpeciesPlantacionId && (
            <ConfigureSpeciesScreen
              plantacionIdProp={configSpeciesPlantacionId}
              onClose={() => setConfigSpeciesPlantacionId(null)}
            />
          )}
        </View>
      </Modal>

      {/* Assign Technicians modal */}
      <Modal
        visible={assignTechPlantacionId !== null}
        animationType="slide"
        onRequestClose={() => setAssignTechPlantacionId(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setAssignTechPlantacionId(null)} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Asignar tecnicos</Text>
          </View>
          {assignTechPlantacionId && (
            <AssignTechniciansScreen
              plantacionIdProp={assignTechPlantacionId}
              onClose={() => setAssignTechPlantacionId(null)}
            />
          )}
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
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSize.title,
    fontWeight: 'bold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMedium,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  createButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    color: colors.textFaint,
  },
  chip: {
    borderRadius: borderRadius.round,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  actionBtnSecondary: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  actionBtnSecondaryText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  actionBtnDanger: {
    backgroundColor: colors.danger,
  },
  actionBtnDangerText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
  },
  lockedText: {
    color: colors.stateFinalizada,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // ─── Create Modal ───────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.round,
    borderTopRightRadius: borderRadius.round,
    padding: spacing['4xl'],
    gap: spacing.xl,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: colors.backgroundAlt,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.dangerText,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    minHeight: 44,
  },
  modalBtnCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnCancelText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  seedModalCard: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xxl,
  },
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
  // ─── Fullscreen modal for admin sub-screens ─────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
    backgroundColor: colors.primary,
    paddingTop: spacing['5xl'] + spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  modalHeaderTitle: {
    color: colors.white,
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
  },
});
