/**
 * PhotoViewer — visor full-screen con zoom (pinch/pan/doble-tap), reutilizado
 * donde se visualiza una foto (N/N, detalle de árbol, registro de árboles).
 * `onReplace`/`onRemove` opcionales agregan una barra de edición; si no, es solo lectura.
 * Con `treeId`, una foto que está solo en la nube se puede descargar desde acá, y el nombre
 * del archivo al guardar/compartir sale de su plantación.
 */
import { useState } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { isRemoteUri } from '../utils/photoUri';
import FotoRemota from './FotoRemota';
import PhotoViewerAcciones from './PhotoViewerAcciones';
import { photoViewerStyles as styles, TAMANO_ICONO_CERRAR } from './PhotoViewer.styles';

interface Props {
  uri: string | null;
  /** Árbol dueño de la foto: sin él, una foto remota no ofrece descargarla. */
  treeId?: string;
  onClose: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
}

export default function PhotoViewer({ uri, treeId, onClose, onReplace, onRemove }: Props) {
  // El caller sigue pasando el path remoto después de bajarla: se muestra el archivo local.
  const [descargada, setDescargada] = useState<{ remota: string; local: string } | null>(null);
  const visible = uri && descargada?.remota === uri ? descargada.local : uri;
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(3);
        savedScale.value = 3;
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function handleClose() {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onClose();
  }

  return (
    <Modal
      visible={!!visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={TAMANO_ICONO_CERRAR} color={colors.white} />
        </Pressable>
        <PhotoViewerAcciones
          uri={visible}
          treeId={treeId}
          onDescargada={(local) => visible && setDescargada({ remota: visible, local })}
        />
        {isRemoteUri(visible) && treeId ? (
          <FotoRemota
            treeId={treeId}
            storagePath={visible}
            oscuro
            style={styles.fotoRemota}
            onDescargada={(local) => setDescargada({ remota: visible, local })}
          />
        ) : (
          <GestureDetector gesture={composedGesture}>
            <Animated.Image
              source={{ uri: visible ?? '' }}
              style={[styles.image, animatedStyle]}
              resizeMode="contain"
            />
          </GestureDetector>
        )}
        {(onReplace || onRemove) && (
          <View style={styles.actions}>
            {onReplace && (
              <Pressable style={styles.actionBtn} onPress={onReplace}>
                <Ionicons name="camera-outline" size={20} color={colors.white} />
                <Text style={styles.actionText}>Reemplazar</Text>
              </Pressable>
            )}
            {onRemove && (
              <Pressable style={styles.actionBtn} onPress={onRemove}>
                <Ionicons name="trash-outline" size={20} color={colors.white} />
                <Text style={styles.actionText}>Eliminar foto</Text>
              </Pressable>
            )}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
