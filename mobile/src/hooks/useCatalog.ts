/**
 * useCatalog — all data logic for CatalogScreen.
 *
 * Encapsulates catalog browsing, selection, batch download,
 * and local plantation deletion logic.
 */
import { useState, useEffect } from 'react';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
import { useNetStatus } from './useNetStatus';
import { useRoutePrefix } from './useRoutePrefix';
import { useConfirm } from './useConfirm';
import { showConfirmDialog, showDoubleConfirmDialog } from '../utils/alertHelpers';
import { getServerCatalog, getLocalPlantationIds, getUnsyncedSubgroupSummary, ServerPlantation } from '../queries/catalogQueries';
import { deletePlantationLocally } from '../repositories/PlantationRepository';
import { batchDownload, DownloadResult, DownloadProgress } from '../services/SyncService';
import { colors } from '../theme';

export function useCatalog() {
  const userId = useCurrentUserId();
  const { profile } = useProfileData();
  const { isOnline } = useNetStatus();
  const routePrefix = useRoutePrefix();
  const confirm = useConfirm();

  const isAdmin = routePrefix === '(admin)';
  const organizacionId = profile?.organizacionId ?? '';

  const [catalogItems, setCatalogItems] = useState<ServerPlantation[]>([]);
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'done'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadResults, setDownloadResults] = useState<DownloadResult[]>([]);

  useEffect(() => {
    if (!isOnline) {
      setCatalogError('No se pudo cargar el catalogo');
      setLoadingCatalog(false);
      return;
    }
    if (!profile?.organizacionId || !userId) return;
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, profile, userId]);

  async function loadCatalog() {
    if (!userId) return;
    setActiveFilter(null);
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const [items, ids] = await Promise.all([
        getServerCatalog(isAdmin, userId, organizacionId),
        getLocalPlantationIds(),
      ]);
      setCatalogItems(items);
      setLocalIds(ids);
    } catch {
      setCatalogError('No se pudo cargar el catalogo');
    } finally {
      setLoadingCatalog(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBatchDownload() {
    const selected = catalogItems.filter((item) => selectedIds.has(item.id));
    setDownloadState('downloading');
    setDownloadProgress(null);
    setDownloadResults([]);
    try {
      const results = await batchDownload(selected, (p) => setDownloadProgress(p));
      setDownloadResults(results);
    } catch {
      setDownloadResults(selected.map((s) => ({ success: false, id: s.id, nombre: s.lugar })));
    } finally {
      setDownloadState('done');
    }
  }

  async function handleDeletePlantation(plantationId: string) {
    const item = catalogItems.find((c) => c.id === plantationId);
    if (!item) return;

    const { activaCount, finalizadaCount } = await getUnsyncedSubgroupSummary(plantationId);
    const hasUnsynced = activaCount + finalizadaCount > 0;

    if (hasUnsynced) {
      const totalUnsynced = activaCount + finalizadaCount;
      showDoubleConfirmDialog(
        confirm.show,
        'Atencion: datos sin sincronizar',
        `Esta plantacion tiene ${totalUnsynced} subgrupo${totalUnsynced !== 1 ? 's' : ''} sin subir al servidor (${activaCount} activo${activaCount !== 1 ? 's' : ''}, ${finalizadaCount} finalizado${finalizadaCount !== 1 ? 's' : ''}). Si eliminas ahora, esos datos se perderan permanentemente.`,
        'Eliminar de todas formas',
        'Los datos sin sincronizar se perderan para siempre. Esta accion no se puede deshacer.',
        async () => {
          await deletePlantationLocally(plantationId);
          getLocalPlantationIds().then((ids) => setLocalIds(ids));
        },
      );
    } else {
      showConfirmDialog(
        confirm.show,
        'Eliminar del dispositivo',
        `La plantacion "${item.lugar}" sera eliminada de tu celular. Podras volver a descargarla desde el catalogo.`,
        'Eliminar',
        async () => {
          await deletePlantationLocally(plantationId);
          getLocalPlantationIds().then((ids) => setLocalIds(ids));
        },
        { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' },
      );
    }
  }

  function handleDismiss() {
    setDownloadState('idle');
    setSelectedIds(new Set());
    getLocalPlantationIds().then((ids) => setLocalIds(ids));
  }

  const estadoCounts = { activa: 0, finalizada: 0 };
  catalogItems.forEach((p) => {
    if (estadoCounts[p.estado as keyof typeof estadoCounts] !== undefined) {
      estadoCounts[p.estado as keyof typeof estadoCounts]++;
    }
  });

  const filteredCatalog = catalogItems.filter(
    (p) => !activeFilter || p.estado === activeFilter
  );

  return {
    // Data
    catalogItems,
    filteredCatalog,
    localIds,
    selectedIds,
    activeFilter,
    estadoCounts,
    isAdmin,
    loadingCatalog,
    catalogError,
    downloadState,
    downloadProgress,
    downloadResults,
    confirmProps: confirm.confirmProps,
    // Actions
    loadCatalog,
    toggleSelection,
    handleBatchDownload,
    handleDeletePlantation,
    handleDismiss,
    setActiveFilter,
  };
}
