/**
 * PhotoCropModal — recorte de la foto recién tomada en UN solo paso (#167).
 * La imagen se muestra con un marco de recorte ajustable (mover + 4 esquinas).
 * El recorte es OPCIONAL: si no se toca el marco, "Guardar" guarda la foto
 * completa. Prioridad: agilidad en campo (una sola acción de guardado).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, Image, Pressable, PanResponder, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import {
  computeDisplayRect, cropBoxToPixels, isFullCrop, moveBox, resizeCorner,
  type Rect, type Corner,
} from '../utils/cropGeometry';
import { cropResizeAndSave, type RawPhoto } from '../services/PhotoService';
import { photoCropModalStyles as styles, HANDLE_SIZE } from './PhotoCropModal.styles';

const MIN_BOX = 60;
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

interface Props {
  raw: RawPhoto | null;
  onCancel: () => void;
  onSave: (uri: string) => void;
  /** Si se pasa, muestra "Reintentar" (reabre cámara/galería según el origen). */
  onRetry?: () => void;
}

export default function PhotoCropModal({ raw, onCancel, onSave, onRetry }: Props) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Rect | null>(null);
  const [saving, setSaving] = useState(false);
  const startBox = useRef<Rect | null>(null);

  // Resolver tamaño real de la imagen (la galería a veces no lo trae).
  useEffect(() => {
    if (!raw) { setImgSize(null); return; }
    if (raw.width > 0 && raw.height > 0) { setImgSize({ w: raw.width, h: raw.height }); return; }
    Image.getSize(raw.uri, (w, h) => setImgSize({ w, h }), () => setImgSize({ w: 1, h: 1 }));
  }, [raw]);

  const disp = useMemo(
    () => (stage && imgSize ? computeDisplayRect(imgSize.w, imgSize.h, stage.w, stage.h) : null),
    [stage, imgSize],
  );

  // Marco inicial = imagen completa (recorte opcional).
  useEffect(() => {
    if (disp) setBox({ x: disp.x, y: disp.y, w: disp.w, h: disp.h });
  }, [disp]);

  const boxRef = useRef<Rect | null>(box); boxRef.current = box;
  const dispRef = useRef<Rect | null>(disp); dispRef.current = disp;

  const movePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startBox.current = boxRef.current; },
      onPanResponderMove: (_e, g) => {
        if (startBox.current && dispRef.current) setBox(moveBox(startBox.current, g.dx, g.dy, dispRef.current));
      },
    }),
  ).current;

  const cornerPans = useRef(
    CORNERS.reduce((acc, corner) => {
      acc[corner] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { startBox.current = boxRef.current; },
        onPanResponderMove: (_e, g) => {
          if (startBox.current && dispRef.current) {
            setBox(resizeCorner(startBox.current, corner, g.dx, g.dy, dispRef.current, MIN_BOX));
          }
        },
      });
      return acc;
    }, {} as Record<Corner, ReturnType<typeof PanResponder.create>>),
  ).current;

  async function handleSave() {
    if (!raw || !box || !disp || !imgSize || saving) return;
    setSaving(true);
    try {
      const pixelCrop = isFullCrop(box, disp) ? null : cropBoxToPixels(box, disp, imgSize.w, imgSize.h);
      onSave(await cropResizeAndSave(raw.uri, pixelCrop, imgSize.w, imgSize.h));
    } catch {
      // Si el recorte falla, guardar la imagen completa antes que perder la foto.
      try { onSave(await cropResizeAndSave(raw.uri, null, imgSize.w, imgSize.h)); }
      catch { onCancel(); }
    } finally {
      setSaving(false);
    }
  }

  const cornerStyle = (corner: Corner) => box && {
    left: (corner === 'tl' || corner === 'bl') ? box.x - HANDLE_SIZE : box.x + box.w - HANDLE_SIZE,
    top: (corner === 'tl' || corner === 'tr') ? box.y - HANDLE_SIZE : box.y + box.h - HANDLE_SIZE,
  };

  return (
    <Modal visible={!!raw} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.container}>
        <Pressable style={[styles.closeBtn, { top: insets.top + spacing.md }]} onPress={onCancel} hitSlop={12} accessibilityLabel="Cancelar">
          <Ionicons name="close" size={26} color={colors.white} />
        </Pressable>
        <View style={styles.stage} onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {raw && disp && (
            <Image source={{ uri: raw.uri }} style={{ position: 'absolute', left: disp.x, top: disp.y, width: disp.w, height: disp.h }} resizeMode="cover" />
          )}
          {box && stage && (
            <>
              {/* Atenuado fuera del marco */}
              <View pointerEvents="none" style={[styles.dim, { left: 0, top: 0, width: stage.w, height: box.y }]} />
              <View pointerEvents="none" style={[styles.dim, { left: 0, top: box.y + box.h, width: stage.w, height: Math.max(0, stage.h - (box.y + box.h)) }]} />
              <View pointerEvents="none" style={[styles.dim, { left: 0, top: box.y, width: box.x, height: box.h }]} />
              <View pointerEvents="none" style={[styles.dim, { left: box.x + box.w, top: box.y, width: Math.max(0, stage.w - (box.x + box.w)), height: box.h }]} />
              {/* Marco movible */}
              <View {...movePan.panHandlers} style={[styles.frame, { left: box.x, top: box.y, width: box.w, height: box.h }]} />
              {/* Esquinas */}
              {CORNERS.map((corner) => (
                <View key={corner} {...cornerPans[corner].panHandlers} style={[styles.handle, cornerStyle(corner)]}>
                  <View style={styles.handleDot} />
                </View>
              ))}
            </>
          )}
        </View>

        <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {onRetry ? (
            <Pressable style={styles.cancelBtn} onPress={onRetry} disabled={saving}>
              <Ionicons name="refresh" size={20} color={colors.white} />
              <Text style={styles.cancelText}>Reintentar</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
              <Ionicons name="close" size={20} color={colors.white} />
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          )}
          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={colors.white} />
              : <><Ionicons name="checkmark" size={20} color={colors.white} /><Text style={styles.saveText}>Guardar</Text></>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
