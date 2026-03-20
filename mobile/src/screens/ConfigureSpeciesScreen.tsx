/**
 * ConfigureSpeciesScreen — species checklist with drag-and-drop reordering.
 *
 * Loads the global species catalog and the current plantation species config.
 * Allows toggling species on/off and drag-reordering enabled species.
 * Species with existing trees are locked (cannot be disabled).
 *
 * Covers requirements: PLAN-02, PLAN-04, PLAN-05
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { asc } from 'drizzle-orm';

import { colors, fontSize, spacing, borderRadius } from '../theme';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import { showInfoDialog } from '../utils/alertHelpers';
import { db } from '../database/client';
import { species as speciesTable } from '../database/schema';
import { getPlantationSpeciesConfig, hasTreesForSpecies } from '../queries/adminQueries';
import { saveSpeciesConfig } from '../repositories/PlantationRepository';

// ─── Types ────────────────────────────────────────────────────────────────────

type SpeciesItem = {
  especieId: string;
  nombre: string;
  codigo: string;
  ordenVisual: number;
  enabled: boolean;
  hasExistingTrees: boolean;
};

// ─── ConfigureSpeciesScreen ───────────────────────────────────────────────────

export default function ConfigureSpeciesScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const confirm = useConfirm();

  const [enabledItems, setEnabledItems] = useState<SpeciesItem[]>([]);
  const [disabledItems, setDisabledItems] = useState<SpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load all species and merge with current config
  const loadData = useCallback(async () => {
    if (!plantacionId) return;
    setLoading(true);
    try {
      const allSpecies = await db
        .select()
        .from(speciesTable)
        .orderBy(asc(speciesTable.nombre));

      const currentConfig = await getPlantationSpeciesConfig(plantacionId);
      const configMap = new Map(currentConfig.map((c) => [c.especieId, c.ordenVisual]));

      const treeChecks = await Promise.all(
        allSpecies.map((sp) => hasTreesForSpecies(plantacionId, sp.id))
      );

      const merged: SpeciesItem[] = allSpecies.map((sp, i) => ({
        especieId: sp.id,
        nombre: sp.nombre,
        codigo: sp.codigo,
        ordenVisual: configMap.has(sp.id) ? configMap.get(sp.id)! : 9999,
        enabled: configMap.has(sp.id),
        hasExistingTrees: treeChecks[i],
      }));

      const enabled = merged
        .filter((i) => i.enabled)
        .sort((a, b) => a.ordenVisual - b.ordenVisual)
        .map((item, idx) => ({ ...item, ordenVisual: idx }));

      const disabled = merged
        .filter((i) => !i.enabled)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      setEnabledItems(enabled);
      setDisabledItems(disabled);
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron cargar las especies.', 'alert-circle-outline', colors.danger);
    } finally {
      setLoading(false);
    }
  }, [plantacionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle species enabled/disabled
  function handleToggle(especieId: string, newValue: boolean) {
    if (newValue) {
      // Move from disabled to end of enabled
      const item = disabledItems.find((i) => i.especieId === especieId);
      if (!item) return;
      const newEnabled = [...enabledItems, { ...item, enabled: true, ordenVisual: enabledItems.length }];
      setEnabledItems(newEnabled);
      setDisabledItems(disabledItems.filter((i) => i.especieId !== especieId));
    } else {
      // Move from enabled to disabled
      const item = enabledItems.find((i) => i.especieId === especieId);
      if (!item) return;
      const newEnabled = enabledItems
        .filter((i) => i.especieId !== especieId)
        .map((i, idx) => ({ ...i, ordenVisual: idx }));
      setEnabledItems(newEnabled);
      setDisabledItems([...disabledItems, { ...item, enabled: false }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
  }

  // Handle drag-and-drop reorder
  function handleDragEnd({ data }: { data: SpeciesItem[] }) {
    setEnabledItems(data.map((item, idx) => ({ ...item, ordenVisual: idx })));
  }

  async function handleSave() {
    if (!plantacionId) return;
    setSaving(true);
    try {
      const config = enabledItems.map((i) => ({ especieId: i.especieId, ordenVisual: i.ordenVisual }));
      await saveSpeciesConfig(plantacionId, config);
      router.back();
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron guardar las especies.', 'alert-circle-outline', colors.danger);
    } finally {
      setSaving(false);
    }
  }

  // Render a draggable enabled species row
  function renderEnabledItem({ item, drag, isActive }: RenderItemParams<SpeciesItem>) {
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          style={[styles.row, styles.rowEnabled, isActive && styles.rowDragging]}
        >
          <Switch
            value={true}
            onValueChange={() => {
              if (item.hasExistingTrees) {
                showInfoDialog(confirm.show, 'No se puede desactivar', 'Esta especie tiene arboles registrados en esta plantacion.', 'lock-closed-outline', colors.secondary);
                return;
              }
              handleToggle(item.especieId, false);
            }}
            trackColor={{ false: colors.border, true: colors.primaryBgMuted }}
            thumbColor={colors.primary}
          />
          <View style={styles.rowInfo}>
            <Text style={styles.rowName}>{item.nombre}</Text>
            <View style={styles.rowMeta}>
              <Text style={styles.rowCode}>{item.codigo}</Text>
              {item.hasExistingTrees && (
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
                  <Text style={styles.lockedText}>Arboles registrados</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="menu" size={20} color={colors.textMuted} />
        </Pressable>
      </ScaleDecorator>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando especies...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Enabled species — draggable */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {enabledItems.length} especie{enabledItems.length !== 1 ? 's' : ''} seleccionada{enabledItems.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.sectionHint}>Mantene presionado para reordenar</Text>
      </View>

      <DraggableFlatList
        data={enabledItems}
        keyExtractor={(item) => item.especieId}
        onDragEnd={handleDragEnd}
        renderItem={renderEnabledItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          disabledItems.length > 0 ? (
            <View>
              <Text style={[styles.sectionTitle, { marginTop: spacing.xxl, marginBottom: spacing.lg }]}>
                Disponibles
              </Text>
              {disabledItems.map((item) => (
                <View key={item.especieId} style={[styles.row, { marginBottom: spacing.md }]}>
                  <Switch
                    value={false}
                    onValueChange={() => handleToggle(item.especieId, true)}
                    trackColor={{ false: colors.border, true: colors.primaryBgMuted }}
                    thumbColor={colors.disabled}
                  />
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, styles.rowNameDisabled]}>{item.nombre}</Text>
                    <Text style={styles.rowCode}>{item.codigo}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
      />

      {/* Save button */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && { opacity: 0.8 },
            saving && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.saveButtonText}>Guardar</Text>
            </>
          )}
        </Pressable>
      </View>

      <ConfirmModal {...confirm.confirmProps} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  sectionHint: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing['5xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
  },
  rowEnabled: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBgLight,
  },
  rowDragging: {
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderColor: colors.primary,
  },
  rowInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  rowName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  rowNameDisabled: {
    color: colors.textMuted,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowCode: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  lockedText: {
    fontSize: fontSize.xxs,
    color: colors.textMuted,
  },
  footer: {
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
