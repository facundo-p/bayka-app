import { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import SpeciesButtonGrid from '../components/SpeciesButtonGrid';
import PhotoViewer from '../components/PhotoViewer';
import CustomHeader from '../components/CustomHeader';
import ConfirmModal from '../components/ConfirmModal';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import { useNNResolution } from '../hooks/useNNResolution';

const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 500;

export default function NNResolutionScreen() {
  const { subgrupoId, subgrupoCodigo, plantacionId } = useLocalSearchParams<{
    subgrupoId?: string;
    subgrupoCodigo?: string;
    plantacionId: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

  const {
    unresolvedTrees,
    species,
    speciesLoading,
    currentTree,
    currentSelectionId,
    selections,
    safeIndex,
    total,
    saving,
    isPlantationMode,
    canResolve,
    zoomPhotoUri,
    confirmProps,
    handleSelectSpecies,
    handleGuardar,
    setCurrentIndex,
    setZoomPhotoUri,
    getConflictForTree,
    acceptServerResolution,
    keepLocalResolution,
  } = useNNResolution({ plantacionId: plantacionId ?? '', subgrupoId, subgrupoCodigo });

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Swipe gesture for photo navigation
  const translateX = useSharedValue(0);

  function goNext() {
    if (safeIndex < total - 1) setCurrentIndex(safeIndex + 1);
  }
  function goPrev() {
    if (safeIndex > 0) setCurrentIndex(safeIndex - 1);
  }

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.7;
    })
    .onEnd((e) => {
      const shouldNavigate =
        Math.abs(e.translationX) > SWIPE_THRESHOLD ||
        Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

      if (shouldNavigate && (e.translationX < 0 || e.velocityX < -VELOCITY_THRESHOLD)) {
        translateX.value = withTiming(-screenWidth * 0.3, { duration: 150, easing: Easing.in(Easing.cubic) });
        runOnJS(goNext)();
      } else if (shouldNavigate && (e.translationX > 0 || e.velocityX > VELOCITY_THRESHOLD)) {
        translateX.value = withTiming(screenWidth * 0.3, { duration: 150, easing: Easing.in(Easing.cubic) });
        runOnJS(goPrev)();
      }
      translateX.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    });

  const photoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

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

  // Build subtitle for header
  const subtitleParts: string[] = [];
  if (isPlantationMode && currentTree.subgrupoNombre) {
    subtitleParts.push(currentTree.subgrupoNombre);
  }
  subtitleParts.push(`Pos ${currentTree.posicion}`);
  const subtitle = subtitleParts.join(' · ');

  return (
    <ScreenContainer withTexture>
      <CustomHeader
        title={`N/N ${safeIndex + 1} de ${total}`}
        onBack={() => router.back()}
        rightElement={
          <Text style={styles.headerInfo}>{subtitle}</Text>
        }
      />

      {/* Sticky photo with swipe */}
      <GestureHandlerRootView>
        <GestureDetector gesture={swipeGesture}>
          <Animated.View style={photoAnimStyle}>
            <Pressable onPress={() => setZoomPhotoUri(currentTree.fotoUrl!)}>
              <Image
                source={{ uri: currentTree.fotoUrl! }}
                style={[styles.photo, { width: screenWidth }]}
                resizeMode="cover"
              />
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Scrollable species grid */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {currentTree?.id && (() => {
          const conflict = getConflictForTree(currentTree.id);
          return conflict ? (
            <View style={styles.conflictBanner}>
              <View style={styles.conflictHeader}>
                <Ionicons name="warning-outline" size={18} color={colors.danger} />
                <Text style={styles.conflictTitle}>Conflicto detectado</Text>
              </View>
              <Text style={styles.conflictBody}>
                Otro usuario resolvio este arbol como {conflict.serverEspecieNombre}.
              </Text>
              <View style={styles.conflictActions}>
                <Pressable onPress={() => acceptServerResolution(currentTree.id)}>
                  <Text style={styles.conflictAcceptText}>Aceptar del servidor</Text>
                </Pressable>
                <Pressable onPress={() => keepLocalResolution(currentTree.id)}>
                  <Text style={styles.conflictKeepText}>Mantener la mia</Text>
                </Pressable>
              </View>
            </View>
          ) : null;
        })()}
        {!canResolve && (
          <Text style={styles.readOnlyLabel}>Resolucion pendiente</Text>
        )}
        {canResolve && (
          speciesLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <SpeciesButtonGrid
              species={species}
              onSelectSpecies={({ especieId }) => handleSelectSpecies(especieId)}
              selectedId={currentSelectionId}
            />
          )
        )}
      </ScrollView>

      {/* Fixed save button */}
      <View style={styles.fixedBottom}>
        <Pressable
          style={[styles.guardarButton, saving && styles.guardarButtonDisabled]}
          onPress={() => handleGuardar(() => router.back())}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.guardarButtonText}>{`Guardar${Object.keys(selections).length > 0 ? ` (${Object.keys(selections).length})` : ''}`}</Text>
          )}
        </Pressable>
      </View>

      <PhotoViewer uri={zoomPhotoUri} onClose={() => setZoomPhotoUri(null)} />
      <ConfirmModal {...confirmProps} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['5xl'] },
  emptyText: { fontSize: fontSize.xl, color: colors.textSecondary, marginBottom: spacing['4xl'], textAlign: 'center' },
  backButton: { backgroundColor: colors.primary, paddingHorizontal: spacing['4xl'], paddingVertical: spacing.xl, borderRadius: borderRadius.lg },
  backButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.lg },
  headerInfo: { color: colors.plantationCountFaded, fontSize: fontSize.sm, fontFamily: fonts.regular },
  photo: { height: 260, backgroundColor: colors.border },
  scrollArea: { flex: 1 },
  scrollContent: { paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  loader: { marginVertical: spacing['4xl'] },
  fixedBottom: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  guardarButton: { backgroundColor: colors.primary, paddingVertical: spacing.xxl, borderRadius: borderRadius.lg, alignItems: 'center' },
  guardarButtonDisabled: { opacity: 0.5 },
  guardarButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.xl },
  conflictBanner: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    padding: spacing.xxl,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  conflictTitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
    color: colors.danger,
  },
  conflictBody: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  conflictActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  conflictAcceptText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  conflictKeepText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  readOnlyLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
