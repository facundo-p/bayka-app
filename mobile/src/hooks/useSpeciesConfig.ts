/**
 * useSpeciesConfig — all data logic for ConfigureSpeciesScreen.
 *
 * Extracts species loading and toggle logic so the screen contains zero
 * direct db imports (CLAUDE.md rule 9).
 */
import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from './useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { getAllSpecies, getPlantationSpeciesConfig, hasTreesForSpecies } from '../queries/adminQueries';
import { saveSpeciesConfig, saveSpeciesConfigLocally } from '../repositories/PlantationRepository';
import { colors } from '../theme';

export type SpeciesItem = {
  especieId: string;
  nombre: string;
  codigo: string;
  ordenVisual: number;
  enabled: boolean;
  hasExistingTrees: boolean;
};

export function useSpeciesConfig(plantacionId: string | undefined, pendingSync?: boolean) {
  const confirm = useConfirm();

  const [items, setItems] = useState<SpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!plantacionId) return;
    setLoading(true);
    try {
      const allSpecies = await getAllSpecies();
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

      // All species alphabetical by name — enabled/disabled stay in place
      merged.sort((a, b) => a.nombre.localeCompare(b.nombre));

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
      // Re-assign ordenVisual for enabled items while keeping alphabetical order
      let order = 0;
      return updated.map((item) =>
        item.enabled ? { ...item, ordenVisual: order++ } : item
      );
    });
  }

  function handleSelectAll() {
    const allEnabled = items.every((i) => i.enabled);
    if (allEnabled) {
      // Deselect all — keep alphabetical order
      setItems((prev) => prev.map((item) => ({ ...item, enabled: false })));
    } else {
      // Select all — assign ordenVisual sequentially (already alphabetical)
      setItems((prev) => prev.map((item, idx) => ({ ...item, enabled: true, ordenVisual: idx })));
    }
  }

  async function handleSave(onClose?: () => void, onBack?: () => void) {
    if (!plantacionId) return;
    setSaving(true);
    try {
      const enabledItems = items
        .filter((i) => i.enabled)
        .map((i) => ({ especieId: i.especieId, ordenVisual: i.ordenVisual }));
      if (pendingSync) {
        await saveSpeciesConfigLocally(plantacionId, enabledItems);
      } else {
        await saveSpeciesConfig(plantacionId, enabledItems);
      }
      if (onClose) {
        onClose();
      } else if (onBack) {
        onBack();
      }
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron guardar las especies.', 'alert-circle-outline', colors.danger);
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = items.filter((i) => i.enabled).length;
  const allEnabled = items.length > 0 && enabledCount === items.length;
  const someEnabled = enabledCount > 0 && !allEnabled;

  return {
    items,
    loading,
    saving,
    enabledCount,
    allEnabled,
    someEnabled,
    confirmProps: confirm.confirmProps,
    handleToggle,
    handleSelectAll,
    handleSave,
  };
}
