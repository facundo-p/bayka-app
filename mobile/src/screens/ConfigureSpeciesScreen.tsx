/**
 * ConfigureSpeciesScreen — species checklist with move-up/down reordering.
 *
 * Loads the global species catalog and the current plantation species config.
 * Allows toggling species on/off and reordering enabled species.
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
  Alert,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { asc } from 'drizzle-orm';

import { colors, fontSize, spacing, borderRadius } from '../theme';
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

  const [items, setItems] = useState<SpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load all species and merge with current config
  const loadData = useCallback(async () => {
    if (!plantacionId) return;
    setLoading(true);
    try {
      // 1. All species from local catalog
      const allSpecies = await db
        .select()
        .from(speciesTable)
        .orderBy(asc(speciesTable.nombre));

      // 2. Current plantation config (ordered by ordenVisual)
      const currentConfig = await getPlantationSpeciesConfig(plantacionId);
      const configMap = new Map(currentConfig.map((c) => [c.especieId, c.ordenVisual]));

      // 3. Check trees for each species in config
      const treeChecks = await Promise.all(
        allSpecies.map((sp) => hasTreesForSpecies(plantacionId, sp.id))
      );

      // 4. Build merged list: enabled species sorted by ordenVisual, disabled ones at end
      const merged: SpeciesItem[] = allSpecies.map((sp, i) => ({
        especieId: sp.id,
        nombre: sp.nombre,
        codigo: sp.codigo,
        ordenVisual: configMap.has(sp.id) ? configMap.get(sp.id)! : 9999,
        enabled: configMap.has(sp.id),
        hasExistingTrees: treeChecks[i],
      }));

      // Sort: enabled items by ordenVisual first, then disabled alphabetically
      merged.sort((a, b) => {
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        if (a.enabled && b.enabled) return a.ordenVisual - b.ordenVisual;
        return a.nombre.localeCompare(b.nombre);
      });

      // Reassign ordenVisual to enabled items sequentially
      let order = 0;
      const normalized = merged.map((item) => {
        if (item.enabled) {
          return { ...item, ordenVisual: order++ };
        }
        return item;
      });

      setItems(normalized);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudieron cargar las especies.');
    } finally {
      setLoading(false);
    }
  }, [plantacionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle species enabled/disabled
  function handleToggle(especieId: string, newValue: boolean) {
    setItems((prev) => {
      const updated = prev.map((item) => {
        if (item.especieId !== especieId) return item;
        return { ...item, enabled: newValue };
      });

      // Re-sort and re-number enabled items
      const enabled = updated.filter((i) => i.enabled);
      const disabled = updated.filter((i) => !i.enabled);

      if (!newValue) {
        // Moved to disabled: maintain current enabled order, reset disabled order
        const reordered = enabled.map((item, idx) => ({ ...item, ordenVisual: idx }));
        return [...reordered, ...disabled];
      } else {
        // Moved to enabled: add at end of enabled list
        const alreadyEnabled = enabled.filter((i) => i.especieId !== especieId);
        const reordered = alreadyEnabled.map((item, idx) => ({ ...item, ordenVisual: idx }));
        const newItem = { ...updated.find((i) => i.especieId === especieId)!, ordenVisual: reordered.length };
        return [...reordered, newItem, ...disabled];
      }
    });
  }

  // Move enabled species up in the list
  function handleMoveUp(especieId: string) {
    setItems((prev) => {
      const enabled = prev.filter((i) => i.enabled);
      const disabled = prev.filter((i) => !i.enabled);
      const idx = enabled.findIndex((i) => i.especieId === especieId);
      if (idx <= 0) return prev;
      const reordered = [...enabled];
      [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
      const renumbered = reordered.map((item, i) => ({ ...item, ordenVisual: i }));
      return [...renumbered, ...disabled];
    });
  }

  // Move enabled species down in the list
  function handleMoveDown(especieId: string) {
    setItems((prev) => {
      const enabled = prev.filter((i) => i.enabled);
      const disabled = prev.filter((i) => !i.enabled);
      const idx = enabled.findIndex((i) => i.especieId === especieId);
      if (idx < 0 || idx >= enabled.length - 1) return prev;
      const reordered = [...enabled];
      [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
      const renumbered = reordered.map((item, i) => ({ ...item, ordenVisual: i }));
      return [...renumbered, ...disabled];
    });
  }

  async function handleSave() {
    if (!plantacionId) return;
    setSaving(true);
    try {
      const enabledItems = items
        .filter((i) => i.enabled)
        .map((i) => ({ especieId: i.especieId, ordenVisual: i.ordenVisual }));

      await saveSpeciesConfig(plantacionId, enabledItems);
      Alert.alert('Listo', 'Especies guardadas.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudieron guardar las especies.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando especies...</Text>
      </View>
    );
  }

  const enabledItems = items.filter((i) => i.enabled);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.especieId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            {enabledItems.length} especie{enabledItems.length !== 1 ? 's' : ''} seleccionada
            {enabledItems.length !== 1 ? 's' : ''}
          </Text>
        }
        renderItem={({ item }) => {
          const enabledIdx = enabledItems.findIndex((i) => i.especieId === item.especieId);
          const isFirst = enabledIdx === 0;
          const isLast = enabledIdx === enabledItems.length - 1;

          return (
            <View style={[styles.row, item.enabled && styles.rowEnabled]}>
              {/* Toggle */}
              <Switch
                value={item.enabled}
                onValueChange={(val) => {
                  if (item.hasExistingTrees && !val) {
                    Alert.alert(
                      'No se puede desactivar',
                      'Esta especie tiene arboles registrados en esta plantacion.',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  handleToggle(item.especieId, val);
                }}
                trackColor={{ false: colors.border, true: colors.primaryBgMuted }}
                thumbColor={item.enabled ? colors.primary : colors.disabled}
              />

              {/* Species info */}
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, !item.enabled && styles.rowNameDisabled]}>
                  {item.nombre}
                </Text>
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

              {/* Move buttons (only for enabled items) */}
              {item.enabled && (
                <View style={styles.moveButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.moveBtn,
                      isFirst && styles.moveBtnDisabled,
                      pressed && !isFirst && { opacity: 0.6 },
                    ]}
                    onPress={() => !isFirst && handleMoveUp(item.especieId)}
                    disabled={isFirst}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={16}
                      color={isFirst ? colors.disabled : colors.primary}
                    />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.moveBtn,
                      isLast && styles.moveBtnDisabled,
                      pressed && !isLast && { opacity: 0.6 },
                    ]}
                    onPress={() => !isLast && handleMoveDown(item.especieId)}
                    disabled={isLast}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={isLast ? colors.disabled : colors.primary}
                    />
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
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
    </View>
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
  listContent: {
    padding: spacing.xxl,
    paddingBottom: spacing['5xl'],
  },
  listHeader: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    fontWeight: '500',
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
  moveButtons: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  moveBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryBg,
  },
  moveBtnDisabled: {
    backgroundColor: colors.background,
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
