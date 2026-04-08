import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { useState, useEffect } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { useProfileData } from '../hooks/useProfileData';
import { useNetStatus } from '../hooks/useNetStatus';
import { getServerCatalog, getLocalPlantationIds, getUnsyncedSubgroupSummary, ServerPlantation } from '../queries/catalogQueries';
import { deletePlantationLocally } from '../repositories/PlantationRepository';
import { batchDownload, DownloadResult, DownloadProgress } from '../services/SyncService';
import { showConfirmDialog, showDoubleConfirmDialog } from '../utils/alertHelpers';
import { useConfirm } from '../hooks/useConfirm';
import ScreenHeader from '../components/ScreenHeader';
import CatalogPlantationCard from '../components/CatalogPlantationCard';
import FilterCards from '../components/FilterCards';
import DownloadProgressModal from '../components/DownloadProgressModal';
import ConfirmModal from '../components/ConfirmModal';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export default function CatalogScreen() {
  const routePrefix = useRoutePrefix();
  const userId = useCurrentUserId();
  const { profile } = useProfileData();
  const { isOnline } = useNetStatus();

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

  const filterConfigs = [
    { key: 'activa', label: 'Activas', count: estadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: estadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

  const filteredCatalog = catalogItems.filter(
    (p) => !activeFilter || p.estado === activeFilter
  );

  const renderContent = () => {
    if (loadingCatalog) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (catalogError) {
      return (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No se pudo cargar el catalogo</Text>
          <Text style={styles.emptySubtext}>Verifica tu conexion y vuelve a intentarlo</Text>
          <Pressable style={styles.retryButton} onPress={loadCatalog}>
            <Text style={styles.retryText}>Reintentar carga</Text>
          </Pressable>
        </View>
      );
    }

    if (catalogItems.length === 0) {
      return (
        <View style={styles.centered}>
          <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No hay plantaciones disponibles</Text>
          <Text style={styles.emptySubtext}>
            {isAdmin
              ? 'Todas las plantaciones del servidor ya estan en tu dispositivo'
              : 'No tenes plantaciones asignadas en el servidor'}
          </Text>
        </View>
      );
    }

    return (
      <>
        <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: spacing.xxl, paddingTop: spacing.xl }}>
          <FilterCards
            filters={filterConfigs}
            activeFilter={activeFilter}
            onToggleFilter={(key) => setActiveFilter(prev => prev === key ? null : key)}
          />
        </Animated.View>
        <FlatList
          data={filteredCatalog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <CatalogPlantationCard
              item={item}
              isDownloaded={localIds.has(item.id)}
              isSelected={selectedIds.has(item.id)}
              onToggle={toggleSelection}
              onDelete={handleDeletePlantation}
            />
          )}
        />
      </>
    );
  };

  const downloadButtonLabel =
    selectedIds.size >= 1
      ? `Descargar ${selectedIds.size} seleccionada(s)`
      : 'Descargar seleccion';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Catalogo de plantaciones" />

      {renderContent()}

      {/* Sticky bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.selectionText}>
          {selectedIds.size > 0 ? `${selectedIds.size} seleccionada(s)` : ''}
        </Text>
        <Pressable
          onPress={handleBatchDownload}
          disabled={selectedIds.size === 0}
          style={[
            styles.downloadButton,
            { backgroundColor: selectedIds.size > 0 ? colors.primary : colors.textDisabled },
          ]}
        >
          <Text style={styles.downloadButtonText}>{downloadButtonLabel}</Text>
        </Pressable>
      </View>

      <DownloadProgressModal
        state={downloadState}
        progress={downloadProgress}
        results={downloadResults}
        onDismiss={handleDismiss}
      />
      <ConfirmModal {...confirm.confirmProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  retryText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    gap: spacing.xl,
    paddingBottom: 96,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionText: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  downloadButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  downloadButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
});
