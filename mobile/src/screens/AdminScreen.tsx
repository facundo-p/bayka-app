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
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import FilterCards from '../components/FilterCards';
import ScreenHeader from '../components/ScreenHeader';
import TexturedBackground from '../components/TexturedBackground';
import AdminPlantationModals from '../components/AdminPlantationModals';
import type { Plantation } from '../components/PlantationConfigCard';
import { usePlantationAdmin } from '../hooks/usePlantationAdmin';

// ─── Types ──────────────────────────────────────────────────────────────────

type EstadoFilter = 'activa' | 'finalizada' | null;

// ─── Estado color map ───────────────────────────────────────────────────────

const estadoColors: Record<string, string> = {
  activa: colors.stateActiva,
  finalizada: colors.stateFinalizada,
  sincronizada: colors.stateSincronizada,
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
  const {
    plantationList,
    filteredList,
    counts,
    activeFilter,
    expandedId,
    expandedMeta,
    seedModalPlantacionId,
    seedValue,
    setSeedValue,
    seedLoading,
    exportingId,
    confirmProps,
    handleToggleFilter,
    handleToggleExpand,
    handleFinalize,
    handleGenerateIds,
    confirmSeedAndGenerate,
    setSeedModalPlantacionId,
    handleExportCsv,
    handleExportExcel,
    handleCreateSubmit,
    handleAssignTech,
    handleEditSubmit,
    handleDiscardEdit,
  } = usePlantationAdmin();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configSpeciesPlantacionId, setConfigSpeciesPlantacionId] = useState<string | null>(null);
  const [assignTechPlantacionId, setAssignTechPlantacionId] = useState<string | null>(null);
  const [editingPlantation, setEditingPlantation] = useState<Plantation | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const onToggleFilter = useCallback((estado: EstadoFilter) => {
    animateLayout();
    handleToggleFilter(estado);
  }, [animateLayout, handleToggleFilter]);

  const onToggleExpand = useCallback((id: string) => {
    animateLayout();
    handleToggleExpand(id);
  }, [animateLayout, handleToggleExpand]);

  async function onAssignTech(plantacionId: string) {
    const ok = await handleAssignTech(plantacionId);
    if (ok) setAssignTechPlantacionId(plantacionId);
  }

  function renderExpandedContent(item: Plantation) {
    const stateColor = estadoColors[item.estado] ?? colors.textMuted;
    return (
      <View style={styles.expandedContent}>
        <View style={styles.expandedSubtitleRow}>
          <Text style={styles.expandedPeriod}>{item.periodo}</Text>
          {item.estado === 'activa' && (
            <Pressable onPress={() => setEditingPlantation(item)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </Pressable>
          )}
          {item.estado === 'finalizada' && <Ionicons name="lock-closed" size={16} color={stateColor} />}
          {item.estado === 'sincronizada' && <Ionicons name="checkmark-circle" size={16} color={stateColor} />}
        </View>

        {(item.pendingSync || item.pendingEdit) && (
          <View style={styles.pendingEditBadge}>
            <Ionicons name="cloud-upload-outline" size={14} color={colors.secondary} />
            <Text style={styles.pendingEditText}>
              {item.pendingSync ? 'Pendiente de sync' : 'Cambios sin sincronizar'}
            </Text>
            {item.pendingEdit && (
              <Pressable
                onPress={() => handleDiscardEdit(item.id)}
                hitSlop={8}
                style={({ pressed }) => [styles.discardButton, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="arrow-undo-outline" size={14} color={colors.danger} />
                <Text style={styles.discardButtonText}>Descartar</Text>
              </Pressable>
            )}
          </View>
        )}

        {item.estado === 'activa' && (
          <View style={styles.actionList}>
            <ActionItem icon="leaf-outline" label="Configurar especies" onPress={() => setConfigSpeciesPlantacionId(item.id)} color={colors.primary} />
            <ActionItem icon="people-outline" label="Asignar técnicos" onPress={() => onAssignTech(item.id)} color={colors.primary} />
            <ActionItem icon="lock-closed-outline" label="Finalizar" onPress={() => handleFinalize(item.id)} color={expandedMeta.canFinalize && !item.pendingSync && !item.pendingEdit ? colors.danger : colors.textMuted} disabled={!expandedMeta.canFinalize || !!item.pendingSync || !!item.pendingEdit} />
            {(item.pendingSync || item.pendingEdit) && <Text style={styles.helperText}>Sincroniza los cambios antes de finalizar</Text>}
            {!expandedMeta.canFinalize && !item.pendingSync && !item.pendingEdit && <Text style={styles.helperText}>Para finalizar, todos los subgrupos deben estar sincronizados</Text>}
          </View>
        )}

        {item.estado === 'finalizada' && (
          <View style={styles.actionList}>
            {!expandedMeta.idsGenerated && <ActionItem icon="key-outline" label="Generar IDs" onPress={() => handleGenerateIds(item.id)} color={colors.primary} />}
            {expandedMeta.idsGenerated && (
              <>
                <ActionItem icon="document-text-outline" label="Exportar CSV" onPress={() => handleExportCsv(item.id)} color={colors.primary} />
                <ActionItem icon="grid-outline" label="Exportar Excel" onPress={() => handleExportExcel(item.id)} color={colors.primary} />
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
            <ActionItem icon="document-text-outline" label="Exportar CSV" onPress={() => handleExportCsv(item.id)} color={colors.primary} />
            <ActionItem icon="grid-outline" label="Exportar Excel" onPress={() => handleExportExcel(item.id)} color={colors.primary} />
          </View>
        )}
      </View>
    );
  }

  return (
    <TexturedBackground>
      <ScreenHeader
        title="Gestión"
        rightElement={
          <Pressable style={({ pressed }) => [styles.headerAddBtn, pressed && { opacity: 0.7 }]} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        }
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <FilterCards
            filters={[
              { key: 'activa', label: 'Activas', count: counts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
              { key: 'finalizada', label: 'Finalizadas', count: counts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
            ]}
            activeFilter={activeFilter}
            onToggleFilter={(key) => onToggleFilter(key as EstadoFilter)}
          />
        </Animated.View>

        {filteredList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No hay plantaciones</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter ? `No hay plantaciones con estado "${activeFilter}"` : 'Crea una plantacion para comenzar'}
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
                      style={({ pressed }) => [styles.accordionHeader, pressed && { backgroundColor: colors.surfacePressed }]}
                      onPress={() => onToggleExpand(item.id)}
                    >
                      <View style={styles.accordionTitleArea}>
                        <Text style={styles.accordionTitle}>{item.lugar}</Text>
                        <View style={[styles.estadoDot, { backgroundColor: stateColor }]} />
                      </View>
                      <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={20} color={colors.textMuted} />
                    </Pressable>
                    {isExpanded && renderExpandedContent(item as Plantation)}
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AdminPlantationModals
        showCreateModal={showCreateModal}
        onCloseCreate={() => setShowCreateModal(false)}
        onCreateSubmit={async (lugar, periodo) => { await handleCreateSubmit(lugar, periodo); setShowCreateModal(false); }}
        editingPlantation={editingPlantation}
        onCloseEdit={() => setEditingPlantation(null)}
        onEditSubmit={async (lugar, periodo) => { if (editingPlantation) { await handleEditSubmit(editingPlantation.id, lugar, periodo); setEditingPlantation(null); } }}
        confirmProps={confirmProps}
        seedModalPlantacionId={seedModalPlantacionId}
        seedValue={seedValue}
        setSeedValue={setSeedValue}
        seedLoading={seedLoading}
        onCloseSeed={() => setSeedModalPlantacionId(null)}
        onConfirmSeed={confirmSeedAndGenerate}
        exportingId={exportingId}
        configSpeciesPlantacionId={configSpeciesPlantacionId}
        onCloseConfigSpecies={() => setConfigSpeciesPlantacionId(null)}
        pendingSyncForSpecies={(plantationList as Plantation[] | null)?.find(p => p.id === configSpeciesPlantacionId)?.pendingSync}
        assignTechPlantacionId={assignTechPlantacionId}
        onCloseAssignTech={() => setAssignTechPlantacionId(null)}
      />
    </TexturedBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.xxl, gap: spacing.xxl, paddingBottom: spacing['5xl'] },
  emptyContainer: { paddingVertical: spacing['6xl'], alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.textMuted },
  emptySubtext: { fontSize: fontSize.base, color: colors.textLight, textAlign: 'center' },
  accordionList: { gap: spacing.md },
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
  accordionTitleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accordionTitle: { fontSize: fontSize.xl, fontFamily: fonts.semiBold, color: colors.text },
  estadoDot: { width: 8, height: 8, borderRadius: borderRadius.full },
  expandedContent: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl, gap: spacing.xl },
  expandedSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expandedPeriod: { fontSize: fontSize.base, color: colors.textFaint },
  actionList: { gap: spacing.md },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    gap: spacing.xl,
  },
  actionItemDisabled: { opacity: 0.4 },
  helperText: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', paddingHorizontal: spacing.xxl, marginTop: -spacing.xs },
  actionItemText: { fontSize: fontSize.base, fontFamily: fonts.medium, color: colors.textSecondary },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, backgroundColor: colors.secondaryBg, borderRadius: borderRadius.lg },
  lockedText: { color: colors.stateFinalizada, fontSize: fontSize.sm, fontFamily: fonts.semiBold },
  pendingEditBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.secondaryBg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  pendingEditText: { fontSize: fontSize.sm, color: colors.secondary, flex: 1 },
  discardButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discardButtonText: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fonts.semiBold },
});
