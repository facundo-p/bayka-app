/**
 * usePlantationAdmin — all data logic for AdminScreen.
 *
 * Encapsulates plantation list, finalization, and export. Los IDs finales se
 * generan desde la web de gestión (issue #232); acá solo se lee el gate
 * idsGenerated para habilitar los exports.
 * Screens import this hook and pass callbacks to components.
 */
import { useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
import { useConfirm } from './useConfirm';
import { useReaperturaPlantacion } from './useReaperturaPlantacion';
import { showInfoDialog } from '../utils/alertHelpers';
import { getPlantationsForRole } from '../queries/dashboardQueries';
import { checkFinalizationGate, hasIdsGenerated, type FinalizationGate } from '../queries/adminQueries';
import {
  updatePlantation,
  finalizePlantation,
  discardPlantationEdit,
  FinalizePlantationLocalSyncError,
  FinalizePlantationPendientesError,
  type AjustesDePlantacion,
} from '../repositories/PlantationRepository';
import type { CamposDePlantacion } from '../utils/camposDePlantacion';
import { createPlantationWithDefaultParcela } from '../services/PlantationCreationService';
import { exportToCSV, exportToExcel, exportToKML } from '../services/ExportService';
import { colors } from '../theme';
import { ESTADO_PLANTACION } from '../constants/estados';
import { plantacionEsEditable } from '../utils/permisosDeEdicion';
import { puedeReabrir } from '../utils/reaperturaPlantacion';
import { mensajeFinalizarConPendientes, tienePendientes } from '../utils/finalizarPlantacion';
import { detalleDePendientes } from '../utils/avisoEliminarDelDispositivo';
import type { Plantation } from '../types/plantation';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExpandedMeta = {
  canFinalize: boolean;
  idsGenerated: boolean;
  unresolvedNNCount: number;
  unresolvedNNGroups: number;
  /** Detalle de lo que falta subir; vacío si no falta nada. */
  pendientesSinSubir: string;
};

// ─── Standalone utility ─────────────────────────────────────────────────────

const SIN_META_DE_FINALIZACION = { canFinalize: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' };

async function fetchMetaDeFinalizacion(plantacionId: string) {
  try {
    const gate = await checkFinalizationGate(plantacionId);
    return {
      canFinalize: gate.canFinalize,
      unresolvedNNCount: gate.unresolvedNNCount,
      unresolvedNNGroups: gate.unresolvedNNGroups,
      pendientesSinSubir: detalleDePendientes(gate.pendientes),
    };
  } catch (e) {
    console.error('[fetchPlantationMeta] checkFinalizationGate failed:', e);
    return SIN_META_DE_FINALIZACION;
  }
}

async function fetchIdsGenerated(plantacionId: string): Promise<boolean> {
  try {
    return await hasIdsGenerated(plantacionId);
  } catch (e) {
    console.error('[fetchPlantationMeta] hasIdsGenerated failed:', e);
    return false;
  }
}

export async function fetchPlantationMeta(plantation: Plantation): Promise<ExpandedMeta> {
  const finalizacion = plantation.estado === ESTADO_PLANTACION.activa
    ? await fetchMetaDeFinalizacion(plantation.id)
    : SIN_META_DE_FINALIZACION;
  const idsGenerated = plantation.estado === ESTADO_PLANTACION.finalizada && await fetchIdsGenerated(plantation.id);
  return { ...finalizacion, idsGenerated };
}

export function usePlantationAdmin() {
  const userId = useCurrentUserId();
  const { profile } = useProfileData();
  const organizacionId = profile?.organizacionId ?? null;
  const { confirmProps, show: showConfirm } = useConfirm();
  const { handleReopen } = useReaperturaPlantacion(showConfirm);

  const [finalizing, setFinalizing] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { data: plantationList } = useLiveData(
    () => getPlantationsForRole(true, userId),
    [userId]
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function avisarNoSePuedeFinalizar(mensaje: string) {
    showInfoDialog(showConfirm, 'No se puede finalizar', mensaje, 'alert-circle-outline', colors.danger);
  }

  async function finalizarConfirmado(plantacionId: string) {
    try {
      await finalizePlantation(plantacionId);
    } catch (e: any) {
      if (e instanceof FinalizePlantationPendientesError) {
        avisarNoSePuedeFinalizar(mensajeFinalizarConPendientes(e.pendientes));
      } else if (e instanceof FinalizePlantationLocalSyncError) {
        showInfoDialog(showConfirm, 'Plantación finalizada', 'La plantación se finalizó en el servidor. Este dispositivo se actualizará en la próxima sincronización.', 'cloud-done-outline', colors.info);
      } else {
        showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo finalizar la plantación.', 'alert-circle-outline', colors.danger);
      }
    }
  }

  function confirmarFinalizacion(plantacionId: string) {
    showConfirm({
      icon: 'warning-outline',
      iconColor: colors.info,
      title: 'Finalizar plantación',
      message: 'Esta acción no se puede deshacer. La plantación quedará bloqueada y no se podrán agregar nuevos grupos.',
      buttons: [
        { label: 'Cancelar', style: 'cancel', onPress: () => {} },
        { label: 'Finalizar', style: 'danger', icon: 'lock-closed-outline', onPress: () => finalizarConfirmado(plantacionId) },
      ],
    });
  }

  function avisarPorQueNoSePuedeFinalizar(gate: FinalizationGate) {
    if (gate.unresolvedNNCount > 0) {
      const plural = gate.unresolvedNNCount > 1 ? 'es' : '';
      const sgPlural = gate.unresolvedNNGroups > 1 ? 's' : '';
      avisarNoSePuedeFinalizar(`${gate.unresolvedNNCount} árbol${plural} N/N sin resolver en ${gate.unresolvedNNGroups} grupo${sgPlural}.`);
    } else if (gate.blocking.length === 0 && tienePendientes(gate.pendientes)) {
      avisarNoSePuedeFinalizar(mensajeFinalizarConPendientes(gate.pendientes));
    } else {
      const blockingNames = gate.blocking.map((b) => `• ${b.nombre} (${b.estado})`).join('\n');
      showConfirm({
        icon: 'close-circle-outline',
        iconColor: colors.danger,
        title: 'No se puede finalizar',
        message: `Los siguientes grupos no están sincronizados:\n\n${blockingNames}`,
        buttons: [{ label: 'Entendido', style: 'primary', onPress: () => {} }],
      });
    }
  }

  async function handleFinalize(plantacionId: string) {
    if (finalizing) return;
    const plantation = (plantationList as Plantation[] | null)?.find(p => p.id === plantacionId);
    if (plantation && !plantacionEsEditable(plantation)) return;
    if (plantation?.pendingSync || plantation?.pendingEdit) {
      showInfoDialog(showConfirm, 'Sincronizá primero', 'Sincronizá la plantación al servidor antes de finalizarla.', 'cloud-upload-outline', colors.info);
      return;
    }
    setFinalizing(true);
    try {
      const gate = await checkFinalizationGate(plantacionId);
      if (gate.canFinalize) {
        confirmarFinalizacion(plantacionId);
      } else {
        avisarPorQueNoSePuedeFinalizar(gate);
      }
    } catch (e: any) {
      showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo verificar el estado.', 'alert-circle-outline', colors.danger);
    } finally {
      setFinalizing(false);
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

  async function handleCreateSubmit(
    lugar: string,
    periodo: string,
    ajustes?: Partial<AjustesDePlantacion>
  ): Promise<string> {
    if (!organizacionId || !userId) {
      throw new Error('No se pudo obtener datos del usuario. Intentá de nuevo.');
    }
    // El alta es local-first; con red se empuja en el acto y si falla queda pendiente de sync.
    const net = await NetInfo.fetch();
    const result = await createPlantationWithDefaultParcela({
      lugar,
      periodo,
      organizacionId,
      creadoPor: userId,
      ajustes,
      mode: net.isConnected === false ? 'offline' : 'online',
    });
    return result.id;
  }

  async function handleEditSubmit(
    plantacionId: string,
    lugar: string,
    periodo: string,
    ajustes?: Partial<AjustesDePlantacion>,
    vistos?: Partial<CamposDePlantacion>
  ): Promise<number> {
    return updatePlantation(plantacionId, lugar, periodo, ajustes, vistos);
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
    plantationList: plantationList as Plantation[] | null,
    exportingId,
    confirmProps,
    handleFinalize,
    canReopen: puedeReabrir(profile?.rol),
    handleReopen,
    handleExportCsv,
    handleExportExcel,
    handleExportKml,
    handleCreateSubmit,
    handleEditSubmit,
    handleDiscardEdit,
  };
}
