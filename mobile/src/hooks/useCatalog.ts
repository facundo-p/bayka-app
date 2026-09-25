/**
 * useCatalog — all data logic for CatalogScreen.
 *
 * Encapsulates catalog browsing, selection and batch download.
 */
import { useState, useEffect } from 'react';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
import { useNetStatus } from './useNetStatus';
import { useRoutePrefix } from './useRoutePrefix';
import { esRutaAdmin } from '../constants/rutas';
import { getServerCatalog, getLocalPlantationIds, ServerPlantation } from '../queries/catalogQueries';
import { batchDownload, DownloadResult, DownloadProgress, DOWNLOAD_STATE, DownloadState } from '../services/SyncService';
import { contarPorEstado } from '../utils/conteoPorEstado';

export function useCatalog() {
  const userId = useCurrentUserId();
  const { profile } = useProfileData();
  const { isOnline } = useNetStatus();
  const routePrefix = useRoutePrefix();

  const isAdmin = esRutaAdmin(routePrefix);
  const organizacionId = profile?.organizacionId ?? '';

  const [catalogItems, setCatalogItems] = useState<ServerPlantation[]>([]);
  const { data: liveLocalIds } = useLiveData(() => getLocalPlantationIds());
  const localIds = liveLocalIds ?? new Set<string>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>(DOWNLOAD_STATE.idle);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadResults, setDownloadResults] = useState<DownloadResult[]>([]);
  const [includePhotos, setIncludePhotos] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setCatalogError('No se pudo cargar el catálogo');
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
      const items = await getServerCatalog(isAdmin, userId, organizacionId);
      setCatalogItems(items);
    } catch {
      setCatalogError('No se pudo cargar el catálogo');
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
    setDownloadState(DOWNLOAD_STATE.downloading);
    setDownloadProgress(null);
    setDownloadResults([]);
    try {
      const results = await batchDownload(selected, (p) => setDownloadProgress(p), { includePhotos });
      setDownloadResults(results);
    } catch {
      setDownloadResults(selected.map((s) => ({ success: false, id: s.id, nombre: s.lugar })));
    } finally {
      setDownloadState(DOWNLOAD_STATE.done);
    }
  }

  function handleDismiss() {
    setDownloadState(DOWNLOAD_STATE.idle);
    setSelectedIds(new Set());
  }

  const estadoCounts = contarPorEstado(catalogItems);

  const filteredCatalog = catalogItems.filter(
    (p) => !activeFilter || p.estado === activeFilter
  );

  return {
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
    includePhotos,
    loadCatalog,
    toggleSelection,
    handleBatchDownload,
    handleDismiss,
    setActiveFilter,
    setIncludePhotos,
  };
}
