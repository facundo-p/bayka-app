import { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import SpeciesButtonGrid from '../components/SpeciesButtonGrid';
import PhotoViewer from '../components/PhotoViewer';
import FotoRemota from '../components/FotoRemota';
import { isRemoteUri } from '../utils/photoUri';
import CustomHeader from '../components/CustomHeader';
import ConfirmModal from '../components/ConfirmModal';
import { colors } from '../theme';
import ScreenContainer from '../components/ScreenContainer';
import { useNNResolution } from '../hooks/useNNResolution';
import { useEstiloBotonera } from '../hooks/useEstiloBotonera';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { nnResolutionScreenStyles as styles } from './NNResolutionScreen.styles';

const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 500;

export default function NNResolutionScreen() {
  const { grupoId, grupoCodigo, plantacionId } = useLocalSearchParams<{
    grupoId?: string;
    grupoCodigo?: string;
    plantacionId: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const botonera = useEstiloBotonera(useCurrentUserId() ?? '');

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
  } = useNNResolution({ plantacionId: plantacionId ?? '', grupoId, grupoCodigo });

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

  if (unresolvedTrees.length === 0 || !currentTree) {
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
  if (isPlantationMode && currentTree.parcelaNombre) {
    subtitleParts.push(currentTree.parcelaNombre);
  }
  if (isPlantationMode && currentTree.grupoNombre) {
    subtitleParts.push(currentTree.grupoNombre);
  }
  subtitleParts.push(`Pos ${currentTree.posicion}`);
  const subtitle = subtitleParts.join(' · ');

  return (
    <ScreenContainer withTexture>
      <CustomHeader
        title={`N/N ${safeIndex + 1} de ${total}`}
        subtitle={subtitle || undefined}
        onBack={() => router.back()}
      />

      {/* Sticky photo with swipe */}
      <GestureHandlerRootView>
        <GestureDetector gesture={swipeGesture}>
          <Animated.View style={photoAnimStyle}>
            {isRemoteUri(currentTree.fotoUrl) ? (
              <FotoRemota
                treeId={currentTree.id}
                storagePath={currentTree.fotoUrl}
                style={[styles.photo, { width: screenWidth }]}
              />
            ) : (
              <Pressable onPress={() => setZoomPhotoUri(currentTree.fotoUrl!)}>
                <Image
                  source={{ uri: currentTree.fotoUrl! }}
                  style={[styles.photo, { width: screenWidth }]}
                  resizeMode="cover"
                />
              </Pressable>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Scrollable species grid */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {!canResolve && (
          <Text style={styles.readOnlyLabel}>Resolucion pendiente</Text>
        )}
        {canResolve && (
          speciesLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <SpeciesButtonGrid
              species={species}
              estilo={botonera.estilo}
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

      <PhotoViewer uri={zoomPhotoUri} treeId={currentTree?.id} onClose={() => setZoomPhotoUri(null)} />
      <ConfirmModal {...confirmProps} />
    </ScreenContainer>
  );
}
