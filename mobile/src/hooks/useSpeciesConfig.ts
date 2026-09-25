/**
 * useSpeciesConfig — all data logic for ConfigureSpeciesScreen.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useConfirm } from './useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { getAllSpecies, getPlantationSpeciesConfig, hasTreesForSpecies } from '../queries/adminQueries';
import { guardarEspeciesDePlantacion } from '../services/EspeciesDePlantacionService';
import { colors } from '../theme';
import { cambiosDeLaSeleccion, mensajeEspeciesConArboles } from '../utils/cambiosDeEspecies';
import { porNombre } from '../utils/ordenEspecies';

export type SpeciesItem = {
  especieId: string;
  nombre: string;
  codigo: string;
  enabled: boolean;
  hasExistingTrees: boolean;
};

/** `conArbolesEnServer`: bajas que el server rechazó por árboles que el teléfono no tiene. */
async function cargarItems(plantacionId: string, conArbolesEnServer: ReadonlySet<string>): Promise<SpeciesItem[]> {
  const [allSpecies, currentConfig] = await Promise.all([getAllSpecies(), getPlantationSpeciesConfig(plantacionId)]);
  const habilitadas = new Set(currentConfig.map((c) => c.especieId));
  const treeChecks = await Promise.all(allSpecies.map((sp) => hasTreesForSpecies(plantacionId, sp.id)));
  return porNombre(allSpecies.map((sp, i) => ({
    especieId: sp.id,
    nombre: sp.nombre,
    codigo: sp.codigo,
    enabled: habilitadas.has(sp.id),
    hasExistingTrees: treeChecks[i] || conArbolesEnServer.has(sp.id),
  })));
}

/** Una especie con árboles en el teléfono no se puede quitar. */
const bloqueada = (item: SpeciesItem) => item.enabled && item.hasExistingTrees;

export function useSpeciesConfig(plantacionId: string | undefined, pendingSync?: boolean) {
  const confirm = useConfirm();

  const [items, setItems] = useState<SpeciesItem[]>([]);
  const [iniciales, setIniciales] = useState<SpeciesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const conArbolesEnServer = useRef(new Set<string>());

  const mostrarError = (e: any, fallback: string) =>
    showInfoDialog(confirm.show, 'Error', e?.message ?? fallback, 'alert-circle-outline', colors.danger);

  const loadData = useCallback(async () => {
    if (!plantacionId) return;
    setLoading(true);
    try {
      const cargados = await cargarItems(plantacionId, conArbolesEnServer.current);
      setItems(cargados);
      setIniciales(cargados);
    } catch (e: any) {
      mostrarError(e, 'No se pudieron cargar las especies.');
    } finally {
      setLoading(false);
    }
  }, [plantacionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleToggle(especieId: string, newValue: boolean) {
    setItems((prev) => prev.map((item) =>
      item.especieId === especieId && !(bloqueada(item) && !newValue) ? { ...item, enabled: newValue } : item
    ));
  }

  function handleSelectAll() {
    const allEnabled = items.every((i) => i.enabled);
    setItems((prev) => prev.map((item) => ({ ...item, enabled: !allEnabled || bloqueada(item) })));
  }

  async function handleSave(onClose?: () => void, onBack?: () => void) {
    if (!plantacionId) return;
    setSaving(true);
    try {
      const conArboles = await guardarEspeciesDePlantacion(plantacionId, cambiosDeLaSeleccion(iniciales, items), !!pendingSync);
      if (conArboles.length > 0) {
        // La pantalla queda abierta: muestra la especie habilitada de nuevo, con candado.
        conArboles.forEach((e) => conArbolesEnServer.current.add(e.especieId));
        await loadData();
        const nombres = conArboles.map((e) => e.nombre);
        showInfoDialog(confirm.show, 'Especies con árboles', mensajeEspeciesConArboles(nombres), 'leaf-outline', colors.info);
        return;
      }
      if (onClose) {
        onClose();
      } else if (onBack) {
        onBack();
      }
    } catch (e: any) {
      await loadData();
      mostrarError(e, 'No se pudieron guardar las especies.');
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
