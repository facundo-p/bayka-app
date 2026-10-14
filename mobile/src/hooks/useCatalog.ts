/**
 * useCatalog — all data logic for CatalogScreen.
 *
 * Encapsulates catalog browsing, selection and batch download.
 */
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useLiveData } from '../database/liveQuery';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
import { useNetStatus } from './useNetStatus';
import { useRoutePrefix } from './useRoutePrefix';
import { esRutaAdmin } from '../constants/rutas';
import { getServerCatalog, getLocalPlantationIds, ServerPlantation } from '../queries/catalogQueries';
import {
  batchDownload, ensureServerSession, esSesionExpirada, DownloadResult, DownloadProgress, DOWNLOAD_STATE, DownloadState,
} from '../services/SyncService';
import { contarPorEstado } from '../utils/conteoPorEstado';
import { rotuloIncluirFotos } from '../utils/pesoDeFotosDelCatalogo';

const CATALOGO_NO_DISPONIBLE = 'No se pudo cargar el catálogo';
const CATALOGO_SIN_SESION = 'Iniciá sesión con conexión para ver el catálogo.';

/** Cómo se dispara la carga: `inicial` muestra spinner y limpia el filtro; el resto no toca la lista visible. */
const MODO_CARGA = { inicial: 'inicial', alEnfocar: 'al-enfocar', manual: 'manual' } as const;
type ModoCarga = (typeof MODO_CARGA)[keyof typeof MODO_CARGA];

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
  const [refreshing, setRefreshing] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>(DOWNLOAD_STATE.idle);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadResults, setDownloadResults] = useState<DownloadResult[]>([]);
  const [includePhotos, setIncludePhotos] = useState(false);

  // Refs para que el efecto de foco no dependa de ellos y no recargue en cada render.
  const itemsRef = useRef<ServerPlantation[]>([]);
  itemsRef.current = catalogItems;
  const descargandoRef = useRef(false);
  descargandoRef.current = downloadState === DOWNLOAD_STATE.downloading;
  const ultimaCargaRef = useRef(0);

  const cargar = useCallback(async (modo: ModoCarga) => {
    if (!userId || !organizacionId) return;
    if (descargandoRef.current) return;
    const hayLista = itemsRef.current.length > 0;
    if (!isOnline) {
      // Offline con lista: se conserva y la pantalla avisa; sin lista, no hay qué mostrar.
      if (!hayLista) setCatalogError(CATALOGO_NO_DISPONIBLE);
      setLoadingCatalog(false);
      return;
    }
    const silenciosa = modo !== MODO_CARGA.inicial && hayLista;
    const carga = ++ultimaCargaRef.current;
    if (modo === MODO_CARGA.manual) setRefreshing(true);
    else if (!silenciosa) {
      setActiveFilter(null);
      setLoadingCatalog(true);
    }
    try {
      // Sin sesión (login offline de otra cuenta, #658) la consulta sale como anon y vuelve vacía.
      await ensureServerSession();
      const items = await getServerCatalog(isAdmin, userId, organizacionId);
      if (carga !== ultimaCargaRef.current) return;
      setCatalogItems(items);
      // Lo seleccionado que ya no está en el catálogo no puede habilitar la descarga.
      setSelectedIds((prev) => {
        const vigentes = new Set(items.filter((i) => prev.has(i.id)).map((i) => i.id));
        return vigentes.size === prev.size ? prev : vigentes;
      });
      setCatalogError(null);
    } catch (e) {
      if (carga !== ultimaCargaRef.current) return;
      // Con lista cargada se conserva en vez de reemplazarla por la pantalla de error.
      if (!silenciosa) setCatalogError(esSesionExpirada(e) ? CATALOGO_SIN_SESION : CATALOGO_NO_DISPONIBLE);
    } finally {
      if (carga === ultimaCargaRef.current) {
        setLoadingCatalog(false);
        setRefreshing(false);
      }
    }
  }, [isOnline, isAdmin, userId, organizacionId]);

  // Al enfocar recarga: la pantalla no se desmonta al volver, y una plantación nueva
  // del servidor no aparecería hasta reiniciar la app (#681).
  useFocusEffect(
    useCallback(() => {
      cargar(MODO_CARGA.alEnfocar);
    }, [cargar])
  );

  const loadCatalog = useCallback(() => cargar(MODO_CARGA.inicial), [cargar]);
  const refreshCatalog = useCallback(() => cargar(MODO_CARGA.manual), [cargar]);

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

  // Sin conexión o descargando el pull no hace nada: la pantalla no monta el RefreshControl
  // para que su spinner nativo no quede girando.
  const puedeRefrescar = isOnline && downloadState !== DOWNLOAD_STATE.downloading;
  const catalogSinSesion = catalogError === CATALOGO_SIN_SESION;

  const estadoCounts = contarPorEstado(catalogItems);
  const rotuloDeFotos = rotuloIncluirFotos(catalogItems, selectedIds);

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
    rotuloIncluirFotos: rotuloDeFotos,
    refreshing,
    sinConexion: !isOnline,
    puedeRefrescar,
    catalogSinSesion,
    loadCatalog,
    refreshCatalog,
    toggleSelection,
    handleBatchDownload,
    handleDismiss,
    setActiveFilter,
    setIncludePhotos,
  };
}
