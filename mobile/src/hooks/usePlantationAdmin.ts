/**
 * usePlantationAdmin — all data logic for AdminScreen.
 *
 * Encapsulates plantation list, finalization, ID generation, and export.
 * Screens import this hook and pass callbacks to components.
 */
import { useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
import { useConfirm } from './useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { getPlantationsForRole } from '../queries/dashboardQueries';
import { checkFinalizationGate, getMaxGlobalId, hasIdsGenerated } from '../queries/adminQueries';
import {
  updatePlantation,
  finalizePlantation,
  discardPlantationEdit,
  PlantationGpsSettings,
} from '../repositories/PlantationRepository';
import { generateAndPersistIds } from '../services/idGenerationService';
// FEATURE: auto-parcela trial — call createPlantationWithDefaultParcela; if dropped revert to PlantationRepository.create directly
import { createPlantationWithDefaultParcela } from '../services/PlantationCreationService';
import { exportToCSV, exportToExcel, exportToKML } from '../services/ExportService';
import { colors } from '../theme';
import type { Plantation } from '../components/PlantationConfigCard';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExpandedMeta = {
  canFinalize: boolean;
  idsGenerated: boolean;
  unresolvedNNCount: number;
  unresolvedNNGroups: number;
};

// ─── Standalone utility ─────────────────────────────────────────────────────

export async function fetchPlantationMeta(plantation: Plantation): Promise<ExpandedMeta> {
  let canFinalize = false;
  let idsGenerated = false;
  let unresolvedNNCount = 0;
  let unresolvedNNGroups = 0;
  if (plantation.estado === 'activa') {
    try {
      const gate = await checkFinalizationGate(plantation.id);
      canFinalize = gate.canFinalize;
      unresolvedNNCount = gate.unresolvedNNCount;
      unresolvedNNGroups = gate.unresolvedNNGroups;
    } catch (e) {
      console.error('[fetchPlantationMeta] checkFinalizationGate failed:', e);
    }
  }
  if (plantation.estado === 'finalizada') {
    try {
      idsGenerated = await hasIdsGenerated(plantation.id);
    } catch (e) {
      console.error('[fetchPlantationMeta] hasIdsGenerated failed:', e);
    }
  }
  return { canFinalize, idsGenerated, unresolvedNNCount, unresolvedNNGroups };
}

export function usePlantationAdmin() {
  const userId = useCurrentUserId();
  const { profile } = useProfileData();
  const organizacionId = profile?.organizacionId ?? null;
  const { confirmProps, show: showConfirm } = useConfirm();

  const [finalizing, setFinalizing] = useState(false);
  const [seedModalPlantacionId, setSeedModalPlantacionId] = useState<string | null>(null);
  const [seedValue, setSeedValue] = useState('');
  const [seedLoading, setSeedLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(true, userId),
    [userId]
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleFinalize(plantacionId: string) {
    if (finalizing) return;
    const plantation = (plantationList as Plantation[] | null)?.find(p => p.id === plantacionId);
    if (plantation?.pendingSync || plantation?.pendingEdit) {
      showInfoDialog(showConfirm, 'Sincroniza primero', 'Sincroniza la plantacion al servidor antes de finalizarla.', 'cloud-upload-outline', colors.info);
      return;
    }
    setFinalizing(true);
    try {
      const gate = await checkFinalizationGate(plantacionId);
      if (gate.canFinalize) {
        showConfirm({
          icon: 'warning-outline',
          iconColor: colors.info,
          title: 'Finalizar plantacion',
          message: 'Esta acción no se puede deshacer. La plantacion quedara bloqueada y no se podran agregar nuevos grupos.',
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
      } else if (gate.unresolvedNNCount > 0) {
        const plural = gate.unresolvedNNCount > 1 ? 'es' : '';
        const sgPlural = gate.unresolvedNNGroups > 1 ? 's' : '';
        showInfoDialog(showConfirm,
          'No se puede finalizar',
          `${gate.unresolvedNNCount} arbol${plural} N/N sin resolver en ${gate.unresolvedNNGroups} grupo${sgPlural}.`,
          'alert-circle-outline',
          colors.danger
        );
      } else {
        const blockingNames = gate.blocking.map((b) => `\u2022 ${b.nombre} (${b.estado})`).join('\n');
        showConfirm({
          icon: 'close-circle-outline',
          iconColor: colors.danger,
          title: 'No se puede finalizar',
          message: `Los siguientes grupos no estan sincronizados:\n\n${blockingNames}`,
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
    // El modal de seed NO se cierra acá: queda abierto con el spinner durante toda
    // la operación (generar + subir al server). Recién al terminar se cierra y se
    // muestra el resultado (éxito/error), para no exponer un estado intermedio
    // (ej. el export apareciendo antes de confirmar la subida).
    setSeedLoading(true);
    try {
      const result = await generateAndPersistIds(pid, seed);
      setSeedModalPlantacionId(null);
      if (result.persisted) {
        showInfoDialog(showConfirm, 'IDs generados', 'Los IDs se generaron y se subieron al servidor correctamente.', 'checkmark-circle-outline', colors.secondary);
      } else {
        showInfoDialog(showConfirm, 'IDs no subidos', 'No se pudieron subir los IDs al servidor. Volvé a tocar "Generar IDs" para reintentar.', 'cloud-offline-outline', colors.danger);
      }
    } catch (e: any) {
      setSeedModalPlantacionId(null);
      showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudieron generar los IDs.', 'alert-circle-outline', colors.danger);
    } finally {
      setSeedLoading(false);
    }
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

  async function handleExportKml(plantacionId: string) {
    const plantation = (plantationList as Plantation[] | null)?.find((p) => p.id === plantacionId);
    if (!plantation) return;
    setExportingId(plantacionId + '_kml');
    try {
      await exportToKML(plantacionId, plantation.lugar);
    } catch (e: any) {
      showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo exportar el KML.', 'alert-circle-outline', colors.danger);
    } finally {
      setExportingId(null);
    }
  }

  // FEATURE: auto-parcela trial — call createPlantationWithDefaultParcela; if dropped revert to PlantationRepository.create directly
  async function handleCreateSubmit(
    lugar: string,
    periodo: string,
    gps?: PlantationGpsSettings
  ): Promise<string> {
    if (!organizacionId || !userId) {
      throw new Error('No se pudo obtener datos del usuario. Intente de nuevo.');
    }
    const base = { lugar, periodo, organizacionId, creadoPor: userId, gps };
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      const result = await createPlantationWithDefaultParcela({ ...base, mode: 'offline' });
      return result.id;
    } else {
      try {
        const result = await createPlantationWithDefaultParcela({ ...base, mode: 'online' });
        return result.id;
      } catch (e: any) {
        if (e?.message?.includes('Network request failed')) {
          const result = await createPlantationWithDefaultParcela({ ...base, mode: 'offline' });
          return result.id;
        } else {
          throw e;
        }
      }
    }
  }

  async function handleAssignTech(plantacionId: string): Promise<boolean> {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      showInfoDialog(showConfirm, 'Sin conexion', 'La asignacion de tecnicos requiere conexion a internet.', 'wifi-outline', colors.info);
      return false;
    }
    return true;
  }

  async function handleEditSubmit(
    plantacionId: string,
    lugar: string,
    periodo: string,
    gps?: PlantationGpsSettings
  ) {
    await updatePlantation(plantacionId, lugar, periodo, gps);
  }

  function handleDiscardEdit(plantacionId: string) {
    showConfirm({
      icon: 'arrow-undo-outline',
      iconColor: colors.secondary,
      title: 'Descartar cambios',
      message: 'Se restaurarán los datos originales del servidor. Los cambios locales se perderán.',
      buttons: [
        { label: 'Cancelar', style: 'cancel', onPress: () => {} },
        {
          label: 'Descartar',
          style: 'danger',
          icon: 'arrow-undo-outline',
          onPress: async () => { await discardPlantationEdit(plantacionId); },
        },
      ],
    });
  }

  return {
    // State
    plantationList: plantationList as Plantation[] | null,
    seedModalPlantacionId,
    seedValue,
    setSeedValue,
    seedLoading,
    exportingId,
    confirmProps,
    // Actions
    handleFinalize,
    handleGenerateIds,
    confirmSeedAndGenerate,
    setSeedModalPlantacionId,
    handleExportCsv,
    handleExportExcel,
    handleExportKml,
    handleCreateSubmit,
    handleAssignTech,
    handleEditSubmit,
    handleDiscardEdit,
  };
}
