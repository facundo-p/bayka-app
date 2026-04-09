import { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import SpeciesButtonGrid from '../components/SpeciesButtonGrid';
import PhotoViewer from '../components/PhotoViewer';
import CustomHeader from '../components/CustomHeader';
import ConfirmModal from '../components/ConfirmModal';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useNNResolution } from '../hooks/useNNResolution';

export default function NNResolutionScreen() {
  const { subgrupoId, subgrupoCodigo, plantacionId } = useLocalSearchParams<{
    subgrupoId?: string;
    subgrupoCodigo?: string;
    plantacionId: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  const {
    unresolvedTrees,
    species,
    speciesLoading,
    currentTree,
    currentSelectionId,
    safeIndex,
    total,
    saving,
    isPlantationMode,
    zoomPhotoUri,
    confirmProps,
    handleSelectSpecies,
    handleGuardar,
    handleAnterior,
    handleSiguiente,
    setZoomPhotoUri,
  } = useNNResolution({ plantacionId: plantacionId ?? '', subgrupoId, subgrupoCodigo });

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  if (unresolvedTrees.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay árboles N/N pendientes</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Resolver N/N" onBack={() => router.back()} />

      <View style={styles.infoRow}>
        <Text style={styles.counterText}>N/N {safeIndex + 1} de {total}</Text>
        <View style={styles.infoRight}>
          {isPlantationMode && currentTree.subgrupoNombre && (
            <Text style={styles.subgrupoLabel}>{currentTree.subgrupoNombre}</Text>
          )}
          {isPlantationMode && currentTree.subgrupoCodigo && (
            <Text style={styles.subgrupoCodeLabel}>{currentTree.subgrupoCodigo}</Text>
          )}
          <Text style={styles.posicionText}>Posicion {currentTree.posicion}</Text>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(300)} style={styles.scrollWrapper}>
        <FlatList
          data={[currentTree]}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {currentTree.fotoUrl ? (
                <Pressable onPress={() => setZoomPhotoUri(currentTree.fotoUrl!)}>
                  <Image source={{ uri: currentTree.fotoUrl }} style={styles.photo} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>Sin foto</Text>
                </View>
              )}
              <Text style={styles.pickerLabel}>Seleccionar especie:</Text>
            </>
          }
          renderItem={() => null}
          ListFooterComponent={
            <>
              {speciesLoading ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : (
                <SpeciesButtonGrid
                  species={species}
                  onSelectSpecies={({ especieId }) => handleSelectSpecies(especieId)}
                  selectedId={currentSelectionId}
                />
              )}

              <View style={styles.navigationRow}>
                <Pressable
                  style={[styles.navButton, safeIndex === 0 && styles.navButtonDisabled]}
                  onPress={handleAnterior}
                  disabled={safeIndex === 0}
                >
                  <Text style={styles.navButtonText}>Anterior</Text>
                </Pressable>
                <Pressable
                  style={[styles.navButton, safeIndex >= total - 1 && styles.navButtonDisabled]}
                  onPress={handleSiguiente}
                  disabled={safeIndex >= total - 1}
                >
                  <Text style={styles.navButtonText}>Siguiente</Text>
                </Pressable>
              </View>
            </>
          }
        />
      </Animated.View>

      <View style={styles.fixedBottom}>
        <Pressable
          style={[styles.guardarButton, saving && styles.guardarButtonDisabled]}
          onPress={() => handleGuardar(() => router.back())}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.guardarButtonText}>Guardar</Text>
          )}
        </Pressable>
      </View>

      <PhotoViewer uri={zoomPhotoUri} onClose={() => setZoomPhotoUri(null)} />
      <ConfirmModal {...confirmProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoRight: { alignItems: 'flex-end', gap: 2 },
  subgrupoLabel: { fontSize: fontSize.md, fontFamily: fonts.semiBold, color: colors.textMedium },
  subgrupoCodeLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace' },
  counterText: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.secondary },
  posicionText: { fontSize: fontSize.base, color: colors.textMuted },
  scrollWrapper: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['5xl'] },
  emptyText: { fontSize: fontSize.xl, color: colors.textSecondary, marginBottom: spacing['4xl'], textAlign: 'center' },
  backButton: { backgroundColor: colors.primary, paddingHorizontal: spacing['4xl'], paddingVertical: spacing.xl, borderRadius: borderRadius.lg },
  backButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.lg },
  photo: { width: '100%', height: 280, borderRadius: borderRadius.lg, marginBottom: spacing.xxl, marginTop: spacing.xxl, backgroundColor: colors.border },
  photoPlaceholder: { width: '100%', height: 280, borderRadius: borderRadius.lg, marginBottom: spacing.xxl, marginTop: spacing.xxl, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { color: colors.textMuted, fontSize: fontSize.xl },
  pickerLabel: { fontSize: fontSize.lg, fontFamily: fonts.semiBold, color: colors.textMedium, marginBottom: spacing.lg, paddingHorizontal: spacing.xxl },
  loader: { marginVertical: spacing['4xl'] },
  navigationRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xxl, marginBottom: spacing.xl, paddingHorizontal: spacing.xxl },
  navButton: { flex: 1, paddingVertical: spacing.xl, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' },
  navButtonDisabled: { borderColor: colors.borderMuted, opacity: 0.4 },
  navButtonText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: fontSize.base },
  fixedBottom: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  guardarButton: { backgroundColor: colors.primary, paddingVertical: spacing.xxl, borderRadius: borderRadius.lg, alignItems: 'center' },
  guardarButtonDisabled: { opacity: 0.5 },
  guardarButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.xl },
});
