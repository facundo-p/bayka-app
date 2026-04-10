import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import CatalogPlantationCard from '../components/CatalogPlantationCard';
import FilterCards from '../components/FilterCards';
import DownloadProgressModal from '../components/DownloadProgressModal';
import ConfirmModal from '../components/ConfirmModal';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useCatalog } from '../hooks/useCatalog';

export default function CatalogScreen() {
  const {
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
    confirmProps,
    loadCatalog,
    toggleSelection,
    handleBatchDownload,
    handleDeletePlantation,
    handleDismiss,
    setActiveFilter,
  } = useCatalog();

  const filterConfigs = [
    { key: 'activa', label: 'Activas', count: estadoCounts.activa, color: colors.stateActiva, icon: 'leaf-outline' },
    { key: 'finalizada', label: 'Finalizadas', count: estadoCounts.finalizada, color: colors.stateFinalizada, icon: 'lock-closed-outline' },
  ];

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

    if (filteredCatalog.length === 0 && !activeFilter) {
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

  const downloadButtonLabel = selectedIds.size >= 1 ? `Descargar ${selectedIds.size} seleccionada(s)` : 'Descargar seleccion';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Catalogo de plantaciones" />
      {renderContent()}
      <View style={styles.bottomBar}>
        <Text style={styles.selectionText}>
          {selectedIds.size > 0 ? `${selectedIds.size} seleccionada(s)` : ''}
        </Text>
        <Pressable
          onPress={handleBatchDownload}
          disabled={selectedIds.size === 0}
          style={[styles.downloadButton, { backgroundColor: selectedIds.size > 0 ? colors.primary : colors.textDisabled }]}
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
      <ConfirmModal {...confirmProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
  emptyTitle: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.textMuted, textAlign: 'center' },
  emptySubtext: { fontSize: fontSize.base, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },
  retryButton: { marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, borderRadius: borderRadius.lg },
  retryText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  listContent: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, gap: spacing.xl, paddingBottom: 96 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionText: { fontSize: fontSize.base, fontFamily: fonts.regular, color: colors.textSecondary },
  downloadButton: { paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl, borderRadius: borderRadius.lg },
  downloadButtonText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
});
