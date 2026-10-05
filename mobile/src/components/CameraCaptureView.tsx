/**
 * CameraCaptureView — cámara in-app (#172). Reemplaza la review nativa del
 * sistema (Reintentar|Aceptar): captura y entrega la foto directo al recorte,
 * sin paso intermedio. La opción de "reintentar" vive en el modal de recorte.
 * Es el primer paso de toda foto (#749): la galería se elige desde acá.
 */
import { useRef, useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions, type PermissionResponse } from 'expo-camera';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import { clamp } from '../utils/cropGeometry';
import type { RawPhoto } from '../services/PhotoService';
import { cameraCaptureStyles as styles, CAMERA_ICON_SIZE } from './CameraCaptureView.styles';

/** Sensibilidad del pinch → cuánto suma al zoom (0..1) por cada unidad de escala. */
const ZOOM_SENSITIVITY = 0.5;

interface Props {
  visible: boolean;
  /** La foto es opcional: cancelar dice «Sin foto» (el registro sigue sin foto). */
  optional: boolean;
  onCapture: (raw: RawPhoto) => void;
  onGallery: () => void;
  onCancel: () => void;
}

function cancelLabel(optional: boolean): string {
  return optional ? 'Sin foto' : 'Cancelar';
}

/** Pinch-to-zoom antes de capturar; arranca en 0 cada vez que se abre la cámara. */
function usePinchZoom(visible: boolean) {
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const baseZoom = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setZoom(0);
    zoomRef.current = 0;
    baseZoom.current = 0;
  }, [visible]);

  // runOnJS: el handler corre en el hilo JS para poder usar setZoom directo.
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

  return { zoom, pinchGesture };
}

interface PermissionPromptProps {
  permission: PermissionResponse;
  requestPermission: () => Promise<PermissionResponse>;
  optional: boolean;
  onGallery: () => void;
  onCancel: () => void;
}

function CameraPermissionPrompt({ permission, requestPermission, optional, onGallery, onCancel }: PermissionPromptProps) {
  return (
    <View style={styles.center}>
      <Ionicons name="camera-outline" size={48} color={colors.white} />
      <Text style={styles.permText}>Necesitamos permiso para usar la cámara.</Text>
      <Pressable
        style={styles.permBtn}
        onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
      >
        <Text style={styles.permBtnText}>{permission.canAskAgain ? 'Permitir' : 'Abrir ajustes'}</Text>
      </Pressable>
      <Pressable style={styles.permGalleryBtn} onPress={onGallery}>
        <Ionicons name="images-outline" size={CAMERA_ICON_SIZE.permGallery} color={colors.white} />
        <Text style={styles.permBtnText}>Elegir de la galería</Text>
      </Pressable>
      <Pressable style={styles.cancelLinkBtn} onPress={onCancel}>
        <Text style={styles.cancelLink}>{cancelLabel(optional)}</Text>
      </Pressable>
    </View>
  );
}

function CloseControl({ optional, onCancel }: { optional: boolean; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const position = { top: insets.top + spacing.xl };
  if (optional) {
    return (
      <Pressable style={[styles.skipBtn, position]} onPress={onCancel} hitSlop={spacing.md}>
        <Text style={styles.skipBtnText}>{cancelLabel(true)}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable style={[styles.closeBtn, position]} onPress={onCancel} hitSlop={spacing.xl} accessibilityLabel="Cerrar cámara">
      <Ionicons name="close" size={CAMERA_ICON_SIZE.close} color={colors.white} />
    </Pressable>
  );
}

interface ShutterBarProps {
  capturing: boolean;
  onCapture: () => void;
  onGallery: () => void;
}

/** Galería a la izquierda, obturador al centro; el hueco derecho lo mantiene centrado. */
function ShutterBar({ capturing, onCapture, onGallery }: ShutterBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.shutterBar, { paddingBottom: insets.bottom + spacing['4xl'] }]}>
      <View style={styles.shutterSide}>
        <Pressable style={styles.galleryBtn} onPress={onGallery} disabled={capturing} accessibilityLabel="Elegir de la galería">
          <Ionicons name="images-outline" size={CAMERA_ICON_SIZE.gallery} color={colors.white} />
          <Text style={styles.galleryBtnText}>Galería</Text>
        </Pressable>
      </View>
      <Pressable style={styles.shutter} onPress={onCapture} disabled={capturing} accessibilityLabel="Tomar foto">
        {capturing ? <ActivityIndicator color={colors.plantation} /> : <View style={styles.shutterInner} />}
      </Pressable>
      <View style={styles.shutterSide} />
    </View>
  );
}

function useTakePicture(onCapture: (raw: RawPhoto) => void) {
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  async function takePicture() {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
      if (photo?.uri) onCapture({ uri: photo.uri, width: photo.width ?? 0, height: photo.height ?? 0 });
    } finally {
      setCapturing(false);
    }
  }

  return { cameraRef, capturing, takePicture };
}

export default function CameraCaptureView({ visible, optional, onCapture, onGallery, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const { zoom, pinchGesture } = usePinchZoom(visible);
  const { cameraRef, capturing, takePicture } = useTakePicture(onCapture);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.container}>
        {!permission ? (
          <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
        ) : !permission.granted ? (
          <CameraPermissionPrompt
            permission={permission}
            requestPermission={requestPermission}
            optional={optional}
            onGallery={onGallery}
            onCancel={onCancel}
          />
        ) : (
          <GestureDetector gesture={pinchGesture}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" zoom={zoom}>
              <CloseControl optional={optional} onCancel={onCancel} />
              <ShutterBar capturing={capturing} onCapture={takePicture} onGallery={onGallery} />
            </CameraView>
          </GestureDetector>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
