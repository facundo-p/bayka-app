/**
 * CameraCaptureView — cámara in-app (#172). Reemplaza la review nativa del
 * sistema (Reintentar|Aceptar): captura y entrega la foto directo al recorte,
 * sin paso intermedio. La opción de "reintentar" vive en el modal de recorte.
 */
import { useRef, useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { clamp } from '../utils/cropGeometry';
import type { RawPhoto } from '../services/PhotoService';
import { cameraCaptureStyles as styles } from './CameraCaptureView.styles';

/** Sensibilidad del pinch → cuánto suma al zoom (0..1) por cada unidad de escala. */
const ZOOM_SENSITIVITY = 0.5;

interface Props {
  visible: boolean;
  onCapture: (raw: RawPhoto) => void;
  onCancel: () => void;
}

export default function CameraCaptureView({ visible, onCapture, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const baseZoom = useRef(0);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // Reset del zoom cada vez que se abre la cámara.
  useEffect(() => {
    if (visible) {
      setZoom(0);
      zoomRef.current = 0;
      baseZoom.current = 0;
    }
  }, [visible]);

  // Pinch-to-zoom antes de capturar. runOnJS: el handler corre en el hilo JS
  // para poder usar setZoom directo (CameraView.zoom es una prop común 0..1).
  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      const next = clamp(baseZoom.current + (e.scale - 1) * ZOOM_SENSITIVITY, 0, 1);
      zoomRef.current = next;
      setZoom(next);
    })
    .onEnd(() => {
      baseZoom.current = zoomRef.current;
    });

  async function handleCapture() {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (photo?.uri) onCapture({ uri: photo.uri, width: photo.width ?? 0, height: photo.height ?? 0 });
    } finally {
      setCapturing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.container}>
        {!permission ? (
          <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={48} color={colors.white} />
            <Text style={styles.permText}>Necesitamos permiso para usar la cámara.</Text>
            <Pressable
              style={styles.permBtn}
              onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
            >
              <Text style={styles.permBtnText}>{permission.canAskAgain ? 'Permitir' : 'Abrir ajustes'}</Text>
            </Pressable>
            <Pressable onPress={onCancel} hitSlop={8}><Text style={styles.cancelLink}>Cancelar</Text></Pressable>
          </View>
        ) : (
          <GestureDetector gesture={pinchGesture}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" zoom={zoom}>
              <Pressable style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={onCancel} hitSlop={12} accessibilityLabel="Cerrar cámara">
                <Ionicons name="close" size={28} color={colors.white} />
              </Pressable>
              <View style={[styles.shutterBar, { paddingBottom: insets.bottom + 24 }]}>
                <Pressable style={styles.shutter} onPress={handleCapture} disabled={capturing} accessibilityLabel="Tomar foto">
                  {capturing ? <ActivityIndicator color={colors.plantation} /> : <View style={styles.shutterInner} />}
                </Pressable>
              </View>
            </CameraView>
          </GestureDetector>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
