/**
 * AdminScreen — plantation management for admins.
 *
 * Accordion dashboard with filter cards.
 * Shows summary cards for estado counts (activa/finalizada/sincronizada).
 * Plantations as expandable rows — only one expanded at a time.
 * Allows creating new plantations via header "+" button.
 *
 * Covers requirements: PLAN-01, PLAN-02, PLAN-03, PLAN-06
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import NetInfo from '@react-native-community/netinfo';

import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { useProfileData } from '../hooks/useProfileData';
import ConfirmModal from '../components/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { getPlantationsForRole } from '../queries/dashboardQueries';
import { checkFinalizationGate, getMaxGlobalId, hasIdsGenerated } from '../queries/adminQueries';
import { createPlantation, createPlantationLocally, updatePlantation, finalizePlantation, generateIds } from '../repositories/PlantationRepository';
import { exportToCSV, exportToExcel } from '../services/ExportService';

import FilterCards from '../components/FilterCards';
import ScreenHeader from '../components/ScreenHeader';
import AdminModalWrapper from '../components/AdminModalWrapper';
import ScreenContainer from '../components/ScreenContainer';
import type { Plantation } from '../components/PlantationConfigCard';
import PlantationFormModal from '../components/PlantationFormModal';
import ConfigureSpeciesScreen from './ConfigureSpeciesScreen';
import AssignTechniciansScreen from './AssignTechniciansScreen';

// ─── Types ──────────────────────────────────────────────────────────────────

type EstadoFilter = 'activa' | 'finalizada' | null;

type ExpandedMeta = {
  canFinalize: boolean;
  idsGenerated: boolean;
};

// ─── Estado color map ───────────────────────────────────────────────────────

const estadoColors: Record<string, string> = {
  activa: colors.stateActiva,
  finalizada: colors.stateFinalizada,
  sincronizada: colors.stateSincronizada,
};

const estadoLabels: Record<string, string> = {
  activa: 'Activas',
  finalizada: 'Finalizadas',
  sincronizada: 'Sincronizadas',
};

const estadoIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  activa: 'leaf-outline',
  finalizada: 'lock-closed-outline',
  sincronizada: 'checkmark-circle-outline',
};

// ─── ActionItem ─────────────────────────────────────────────────────────────

function ActionItem({
  icon,
  label,
  onPress,
  color,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionItem,
        disabled && styles.actionItemDisabled,
        pressed && !disabled && { opacity: 0.7 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={18} color={color ?? colors.textSecondary} />
      <Text style={[styles.actionItemText, color ? { color } : undefined]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── AdminScreen ────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const userId = useCurrentUserId();
  const { profile } = useProfileData();
  const organizacionId = profile?.organizacionId ?? null;

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

  // Filter & accordion state
  const [activeFilter, setActiveFilter] = useState<EstadoFilter>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedMeta, setExpandedMeta] = useState<ExpandedMeta>({ canFinalize: false, idsGenerated: false });
  const initialExpandDone = useRef(false);

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(true, userId),
    [userId]
  );

  // Set initial expanded to most recent plantation
  useEffect(() => {
    if (initialExpandDone.current || !plantationList || plantationList.length === 0) return;
    const sorted = [...plantationList].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    initialExpandDone.current = true;
    setExpandedId(sorted[0]?.id ?? null);
  }, [plantationList]);

  // Fetch metadata for expanded plantation
  useEffect(() => {
    if (!expandedId) {
      setExpandedMeta({ canFinalize: false, idsGenerated: false });
      return;
    }
    const item = (plantationList as Plantation[] | null)?.find(p => p.id === expandedId);
    if (!item) return;

    let cancelled = false;
    const fetchMeta = async () => {
      let canFinalize = false;
      let idsGen = false;

      if (item.estado === 'activa') {
        try {
          const gate = await checkFinalizationGate(item.id);
          canFinalize = gate.canFinalize;
        } catch { /* ignore */ }
      }
      if (item.estado === 'finalizada') {
        try {
          idsGen = await hasIdsGenerated(item.id);
        } catch { /* ignore */ }
      }
      if (item.estado === 'sincronizada') {
        idsGen = true; // sincronizada always has IDs
      }

      if (!cancelled) {
        setExpandedMeta({ canFinalize, idsGenerated: idsGen });
      }
    };
    fetchMeta();
    return () => { cancelled = true; };
  }, [expandedId, plantationList]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const counts = { activa: 0, finalizada: 0 };
  (plantationList as Plantation[] | null)?.forEach(p => {
    if (counts[p.estado as keyof typeof counts] !== undefined) {
      counts[p.estado as keyof typeof counts]++;
    }
  });

  const filteredList = (plantationList as Plantation[] | null)?.filter(
    p => !activeFilter || p.estado === activeFilter
  ) ?? [];

  // ─── Animation helpers ────────────────────────────────────────────────────

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const handleToggleFilter = useCallback((estado: EstadoFilter) => {
    animateLayout();
    setActiveFilter(prev => prev === estado ? null : estado);
  }, [animateLayout]);

  const handleToggleExpand = useCallback((id: string) => {
    animateLayout();
    setExpandedId(prev => prev === id ? null : id);
  }, [animateLayout]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleFinalize(plantacionId: string) {
    if (finalizing) return;
    const plantation = (plantationList as Plantation[] | null)?.find(p => p.id === plantacionId);
    if (plantation?.pendingSync) {
      showInfoDialog(showConfirm, 'Sincroniza primero', 'Sincroniza la plantacion al servidor antes de finalizarla.', 'cloud-upload-outline', colors.stateFinalizada);
      return;
    }
    setFinalizing(true);
    try {
      const gate = await checkFinalizationGate(plantacionId);
      if (gate.canFinalize) {
        showConfirm({
          icon: 'warning-outline',
          iconColor: colors.stateFinalizada,
          title: 'Finalizar plantacion',
          message:
            'Esta acción no se puede deshacer. La plantacion quedara bloqueada y no se podran agregar nuevos subgrupos.',
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
      showInfoDialog(showConfirm, 'Semilla invalida', 'Ingresa un número entero mayor a 0.', 'alert-circle-outline', colors.secondary);
      return;
    }
    const pid = seedModalPlantacionId;
    setSeedModalPlantacionId(null);
    showConfirm({
      icon: 'key-outline',
      iconColor: colors.primary,
      title: 'Generar IDs',
      message: 'Se van a generar IDs para todos los árboles de esta plantación. Esta acción no se puede deshacer.',
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
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      await createPlantationLocally(lugar, periodo, organizacionId, userId);
    } else {
      try {
        await createPlantation(lugar, periodo, organizacionId, userId);
      } catch (e: any) {
        if (e?.message?.includes('Network request failed')) {
          await createPlantationLocally(lugar, periodo, organizacionId, userId);
        } else {
          throw e;
        }
      }
    }
    setShowCreateModal(false);
  }

  async function handleAssignTech(plantacionId: string) {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      showInfoDialog(showConfirm, 'Sin conexion', 'La asignacion de tecnicos requiere conexion a internet.', 'wifi-outline', colors.stateFinalizada);
      return;
    }
    setAssignTechPlantacionId(plantacionId);
  }

  async function handleEditSubmit(lugar: string, periodo: string) {
    if (!editingPlantation) return;
    await updatePlantation(editingPlantation.id, lugar, periodo);
    setEditingPlantation(null);
  }

  // ─── Render expanded content ──────────────────────────────────────────────

  function renderExpandedContent(item: Plantation) {
    const stateColor = estadoColors[item.estado] ?? colors.textMuted;

    return (
      <View style={styles.expandedContent}>
        {/* Period subtitle with state icon */}
        <View style={styles.expandedSubtitleRow}>
          <Text style={styles.expandedPeriod}>{item.periodo}</Text>
          {item.estado === 'activa' && (
            <Pressable
              onPress={() => setEditingPlantation(item)}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </Pressable>
          )}
          {item.estado === 'finalizada' && (
            <Ionicons name="lock-closed" size={16} color={stateColor} />
          )}
          {item.estado === 'sincronizada' && (
            <Ionicons name="checkmark-circle" size={16} color={stateColor} />
          )}
        </View>

        {/* Actions per estado */}
        {item.estado === 'activa' && (
          <View style={styles.actionList}>
            <ActionItem
              icon="leaf-outline"
              label="Configurar especies"
              onPress={() => setConfigSpeciesPlantacionId(item.id)}
              color={colors.primary}
            />
            <ActionItem
              icon="people-outline"
              label="Asignar técnicos"
              onPress={() => handleAssignTech(item.id)}
              color={colors.primary}
            />
            <ActionItem
              icon="lock-closed-outline"
              label="Finalizar"
              onPress={() => handleFinalize(item.id)}
              color={expandedMeta.canFinalize ? colors.danger : colors.textMuted}
              disabled={!expandedMeta.canFinalize}
            />
            {!expandedMeta.canFinalize && (
              <Text style={styles.helperText}>
                Para finalizar, todos los subgrupos deben estar sincronizados
              </Text>
            )}
          </View>
        )}

        {item.estado === 'finalizada' && (
          <View style={styles.actionList}>
            {!expandedMeta.idsGenerated && (
              <ActionItem
                icon="key-outline"
                label="Generar IDs"
                onPress={() => handleGenerateIds(item.id)}
                color={colors.primary}
              />
            )}
            {expandedMeta.idsGenerated && (
              <>
                <ActionItem
                  icon="document-text-outline"
                  label="Exportar CSV"
                  onPress={() => handleExportCsv(item.id)}
                  color={colors.primary}
                />
                <ActionItem
                  icon="grid-outline"
                  label="Exportar Excel"
                  onPress={() => handleExportExcel(item.id)}
                  color={colors.primary}
                />
              </>
            )}
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={12} color={colors.stateFinalizada} />
              <Text style={styles.lockedText}>Bloqueada</Text>
            </View>
          </View>
        )}

        {item.estado === 'sincronizada' && (
          <View style={styles.actionList}>
            <ActionItem
              icon="document-text-outline"
              label="Exportar CSV"
              onPress={() => handleExportCsv(item.id)}
              color={colors.primary}
            />
            <ActionItem
              icon="grid-outline"
              label="Exportar Excel"
              onPress={() => handleExportExcel(item.id)}
              color={colors.primary}
            />
          </View>
        )}
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScreenContainer withTexture>
      {/* Header */}
      <ScreenHeader
        title="Gestión"
        rightElement={
          <Pressable
            style={({ pressed }) => [styles.headerAddBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Summary filter cards */}
        <Animated.View entering={FadeInDown.duration(300)}>
        <FilterCards
          filters={[
            { key: 'activa', label: 'Activas', count: counts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
            { key: 'finalizada', label: 'Finalizadas', count: counts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
          ]}
          activeFilter={activeFilter}
          onToggleFilter={(key) => handleToggleFilter(key as EstadoFilter)}
        />
        </Animated.View>

        {/* Accordion list */}
        {filteredList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No hay plantaciones</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter
                ? `No hay plantaciones con estado "${activeFilter}"`
                : 'Crea una plantacion para comenzar'}
            </Text>
          </View>
        ) : (
          <View style={styles.accordionList}>
            {filteredList.map((item, index) => {
              const isExpanded = expandedId === item.id;
              const stateColor = estadoColors[item.estado] ?? colors.textMuted;

              return (
                <Animated.View key={item.id} entering={FadeInDown.delay(index * 80).duration(300)}>
                <View style={[styles.accordionItem, { borderLeftColor: stateColor }]}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.accordionHeader,
                      pressed && { backgroundColor: colors.surfacePressed },
                    ]}
                    onPress={() => handleToggleExpand(item.id)}
                  >
                    <View style={styles.accordionTitleArea}>
                      <Text style={styles.accordionTitle}>{item.lugar}</Text>
                      <View style={[styles.estadoDot, { backgroundColor: stateColor }]} />
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {isExpanded && renderExpandedContent(item as Plantation)}
                </View>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

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
              pendingSync={(plantationList as Plantation[] | null)?.find(p => p.id === configSpeciesPlantacionId)?.pendingSync}
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
          title="Asignar técnicos"
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
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ─── Header ─────────────────────────────────────────────────────────────
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── ScrollView ─────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xxl,
    gap: spacing.xxl,
    paddingBottom: spacing['5xl'],
  },

  // ─── Empty state ────────────────────────────────────────────────────────
  emptyContainer: {
    paddingVertical: spacing['6xl'],
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  emptySubtext: {
    fontSize: fontSize.base,
    color: colors.textLight,
    textAlign: 'center',
  },

  // ─── Accordion ──────────────────────────────────────────────────────────
  accordionList: {
    gap: spacing.md,
  },
  accordionItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  accordionTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accordionTitle: {
    fontSize: fontSize.xl,
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  estadoDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },

  // ─── Expanded content ──────────────────────────────────────────────────
  expandedContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  expandedSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expandedPeriod: {
    fontSize: fontSize.base,
    color: colors.textFaint,
  },

  // ─── Action items ──────────────────────────────────────────────────────
  actionList: {
    gap: spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    gap: spacing.xl,
  },
  actionItemDisabled: {
    opacity: 0.4,
  },
  helperText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: spacing.xxl,
    marginTop: -spacing.xs,
  },
  actionItemText: {
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  // ─── Locked badge ──────────────────────────────────────────────────────
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
  },
  lockedText: {
    color: colors.stateFinalizada,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },

  // ─── Seed dialog ───────────────────────────────────────────────────────
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
  seedBtnPrimary: {
    backgroundColor: colors.primary,
  },
  seedBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },

  // ─── Export overlay ────────────────────────────────────────────────────
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
    fontFamily: fonts.semiBold,
  },
});
