/**
 * ConfigureSpeciesScreen — species toggle list.
 * Allows enabling/disabling species for a plantation.
 * Species with existing trees are locked (cannot be disabled).
 * Reordering is done in a separate screen (ReorderSpeciesScreen).
 *
 * Covers requirements: PLAN-02, PLAN-04
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
import { asc } from 'drizzle-orm';

import { colors, fontSize, spacing, borderRadius } from '../theme';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import { showInfoDialog } from '../utils/alertHelpers';
import { db } from '../database/client';
import { species as speciesTable } from '../database/schema';
import { getPlantationSpeciesConfig, hasTreesForSpecies } from '../queries/adminQueries';
import { saveSpeciesConfig } from '../repositories/PlantationRepository';

type SpeciesItem = {
  especieId: string;
  nombre: string;
  codigo: string;
  ordenVisual: number;
  enabled: boolean;
  hasExistingTrees: boolean;
};

export default function ConfigureSpeciesScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();

  const [items, setItems] = useState<SpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      // Enabled first (by ordenVisual), then disabled (alphabetical)
      merged.sort((a, b) => {
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        if (a.enabled && b.enabled) return a.ordenVisual - b.ordenVisual;
        return a.nombre.localeCompare(b.nombre);
      });

      let order = 0;
      const normalized = merged.map((item) =>
        item.enabled ? { ...item, ordenVisual: order++ } : item
      );

      setItems(normalized);
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron cargar las especies.', 'alert-circle-outline', colors.danger);
    } finally {
      setLoading(false);
    }
  }, [plantacionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleToggle(especieId: string, newValue: boolean) {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.especieId === especieId ? { ...item, enabled: newValue } : item
      );
      const enabled = updated.filter((i) => i.enabled).map((item, idx) => ({ ...item, ordenVisual: idx }));
      const disabled = updated.filter((i) => !i.enabled).sort((a, b) => a.nombre.localeCompare(b.nombre));
      return [...enabled, ...disabled];
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
      router.back();
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron guardar las especies.', 'alert-circle-outline', colors.danger);
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = items.filter((i) => i.enabled).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando especies...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.especieId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
            <Text style={styles.listHeader}>
              {enabledCount} especie{enabledCount !== 1 ? 's' : ''} seleccionada{enabledCount !== 1 ? 's' : ''}
            </Text>
            {enabledCount > 1 && (
              <Pressable
                style={({ pressed }) => [styles.reorderLink, pressed && { opacity: 0.6 }]}
                onPress={() => router.push(`/(admin)/plantation/reorder-species?plantacionId=${plantacionId}` as any)}
              >
                <Ionicons name="grid-outline" size={14} color={colors.info} />
                <Text style={styles.reorderLinkText}>Ordenar botonera</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, item.enabled && styles.rowEnabled]}>
            <Switch
              value={item.enabled}
              onValueChange={(val) => {
                if (item.hasExistingTrees && !val) {
                  showInfoDialog(confirm.show, 'No se puede desactivar', 'Esta especie tiene arboles registrados en esta plantacion.', 'lock-closed-outline', colors.secondary);
                  return;
                }
                handleToggle(item.especieId, val);
              }}
              trackColor={{ false: colors.border, true: colors.primaryBgMuted }}
              thumbColor={item.enabled ? colors.primary : colors.disabled}
            />
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, !item.enabled && styles.rowNameDisabled]}>{item.nombre}</Text>
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
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }, saving && { opacity: 0.6 }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl, backgroundColor: colors.background },
  loadingText: { fontSize: fontSize.base, color: colors.textMuted },
  listContent: { padding: spacing.xxl, paddingBottom: spacing['5xl'] },
  listHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  listHeader: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
  reorderLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reorderLinkText: { fontSize: fontSize.sm, color: colors.info, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xl,
  },
  rowEnabled: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryBgLight },
  rowInfo: { flex: 1, gap: spacing.xs },
  rowName: { fontSize: fontSize.base, fontWeight: '600', color: colors.text },
  rowNameDisabled: { color: colors.textMuted },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowCode: { fontSize: fontSize.sm, color: colors.textMuted, fontFamily: 'monospace' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.background, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  lockedText: { fontSize: fontSize.xxs, color: colors.textMuted },
  footer: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, gap: spacing.sm },
  saveButtonText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '600' },
});
