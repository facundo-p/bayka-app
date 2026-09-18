import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import CatalogPlantationCard from '../components/CatalogPlantationCard';
import FilterCards from '../components/FilterCards';
import { filtrosDeEstado } from '../components/filtrosDeEstado';
import DownloadProgressModal from '../components/DownloadProgressModal';
import CustomHeader from '../components/CustomHeader';
import { colors, spacing } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useScreenBack } from '../hooks/useScreenBack';
import { useCatalog } from '../hooks/useCatalog';
import { catalogScreenStyles as styles } from './CatalogScreen.styles';

export default function CatalogScreen() {
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
    loadCatalog,
    toggleSelection,
    handleBatchDownload,
    handleDismiss,
    setActiveFilter,
    setIncludePhotos,
  } = useCatalog();

  const filterConfigs = filtrosDeEstado(estadoCounts);

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
          <Text style={styles.emptyTitle}>No se pudo cargar el catálogo</Text>
          <Text style={styles.emptySubtext}>Verificá tu conexión y volvé a intentarlo</Text>
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
              ? 'Todas las plantaciones del servidor ya están en tu dispositivo'
              : 'No tenés plantaciones asignadas en el servidor'}
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

  const downloadButtonLabel = 'Descargar seleccion';
  const goBack = useScreenBack(`/${routePrefix}/plantaciones`);

  return (
    <ScreenContainer withTexture>
      <CustomHeader
        title="Catálogo de plantaciones"
        onBack={goBack}
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
    </ScreenContainer>
  );
}
