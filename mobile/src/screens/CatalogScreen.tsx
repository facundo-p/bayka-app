import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import CatalogPlantationCard from '../components/CatalogPlantationCard';
import FilterCards from '../components/FilterCards';
import DownloadProgressModal from '../components/DownloadProgressModal';
import ConfirmModal from '../components/ConfirmModal';
import CustomHeader from '../components/CustomHeader';
import { colors, spacing } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useCatalog } from '../hooks/useCatalog';
import { catalogScreenStyles as styles } from './CatalogScreen.styles';

export default function CatalogScreen() {
  const router = useRouter();
  const routePrefix = useRoutePrefix();
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
    includePhotos,
    confirmProps,
    loadCatalog,
    toggleSelection,
    handleBatchDownload,
    handleDismiss,
    setActiveFilter,
    setIncludePhotos,
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
            />
          )}
        />
      </>
    );
  };

  const downloadButtonLabel = selectedIds.size >= 1 ? `Descargar ${selectedIds.size} seleccionada(s)` : 'Descargar seleccion';

  return (
    <ScreenContainer withTexture>
      <CustomHeader
        title="Catálogo de plantaciones"
        onBack={() => router.navigate(`/${routePrefix}/plantaciones` as any)}
      />
      {renderContent()}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => setIncludePhotos(!includePhotos)}
          style={styles.photosToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includePhotos }}
        >
          <Ionicons
            name={includePhotos ? 'checkbox' : 'square-outline'}
            size={22}
            color={includePhotos ? colors.primary : colors.textMuted}
          />
          <Text style={styles.photosToggleLabel}>Incluir fotos</Text>
        </Pressable>
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
    </ScreenContainer>
  );
}
