/**
 * usePlantationAdmin — all data logic for AdminScreen.
 *
 * Encapsulates plantation list, finalization, ID generation, and export.
 * Screens import this hook and pass callbacks to components.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
import { useConfirm } from './useConfirm';
import { showInfoDialog } from '../utils/alertHelpers';
import { getPlantationsForRole } from '../queries/dashboardQueries';
import { checkFinalizationGate, getMaxGlobalId, hasIdsGenerated } from '../queries/adminQueries';
import {
  createPlantation,
  createPlantationLocally,
  updatePlantation,
  finalizePlantation,
  generateIds,
  discardPlantationEdit,
} from '../repositories/PlantationRepository';
import { exportToCSV, exportToExcel } from '../services/ExportService';
import { colors } from '../theme';
import type { Plantation } from '../components/PlantationConfigCard';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EstadoFilter = 'activa' | 'finalizada' | null;

export type ExpandedMeta = {
  canFinalize: boolean;
  idsGenerated: boolean;
};

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

  const [activeFilter, setActiveFilter] = useState<EstadoFilter>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedMeta, setExpandedMeta] = useState<ExpandedMeta>({ canFinalize: false, idsGenerated: false });
  const initialExpandDone = useRef(false);

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
        idsGen = true;
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

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleFilter = useCallback((estado: EstadoFilter) => {
    setActiveFilter(prev => prev === estado ? null : estado);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  async function handleFinalize(plantacionId: string) {
    if (finalizing) return;
    const plantation = (plantationList as Plantation[] | null)?.find(p => p.id === plantacionId);
    if (plantation?.pendingSync || plantation?.pendingEdit) {
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
          message: 'Esta acción no se puede deshacer. La plantacion quedara bloqueada y no se podran agregar nuevos subgrupos.',
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
  }

  async function handleAssignTech(plantacionId: string): Promise<boolean> {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      showInfoDialog(showConfirm, 'Sin conexion', 'La asignacion de tecnicos requiere conexion a internet.', 'wifi-outline', colors.stateFinalizada);
      return false;
    }
    return true;
  }

  async function handleEditSubmit(plantacionId: string, lugar: string, periodo: string) {
    await updatePlantation(plantacionId, lugar, periodo);
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
    // Actions
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
  };
}
