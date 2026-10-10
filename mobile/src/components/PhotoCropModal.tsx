/**
 * PhotoCropModal — recorte de la foto recién tomada o elegida, en un solo paso (#167).
 * El marco es siempre cuadrado (#831): arranca en el cuadrado centrado más grande,
 * el mismo del visor, y se mueve o se agranda sin perder el 1:1. Guardar recorta
 * eso; no hay forma de guardar la foto entera.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, Image, Pressable, PanResponder, ActivityIndicator, type PanResponderInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import {
  CORNERS, computeDisplayRect, cornerPoint, cropBoxToPixels, largestCenteredSquare, moveBox, rectToLayout, resizeCorner,
  type Corner, type Rect, type Size,
} from '../utils/cropGeometry';
import { avisoBreve } from '../utils/avisoBreve';
import { cropResizeAndSave, type RawPhoto } from '../services/PhotoService';
import CropMask from './CropMask';
import { photoCropModalStyles as styles, HANDLE_SIZE, CROP_ICON_SIZE } from './PhotoCropModal.styles';

const MIN_BOX = 60;
const AVISO = {
  noSeAbrio: 'No se pudo abrir la foto.',
  noSeGuardo: 'No se pudo guardar la foto. Probá de nuevo.',
} as const;

interface Props {
  raw: RawPhoto | null;
  onCancel: () => void;
  onSave: (uri: string) => void;
  /** Si se pasa, muestra "Reintentar" (vuelve a la cámara). */
  onRetry?: () => void;
}

/** Tamaño real de la imagen: la galería a veces no lo trae. */
function useImageSize(raw: RawPhoto | null, onError: () => void): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    setSize(null);
    if (!raw) return;
    if (raw.width > 0 && raw.height > 0) { setSize({ w: raw.width, h: raw.height }); return; }
    Image.getSize(raw.uri, (w, h) => setSize({ w, h }), () => {
      avisoBreve(AVISO.noSeAbrio);
      onErrorRef.current();
    });
  }, [raw]);
  return size;
}

function useCropBox(stage: Size | null, imgSize: Size | null) {
  const disp = useMemo(
    () => (stage && imgSize ? computeDisplayRect(imgSize.w, imgSize.h, stage.w, stage.h) : null),
    [stage, imgSize],
  );
  const [box, setBox] = useState<Rect | null>(null);
  useEffect(() => { setBox(disp ? largestCenteredSquare(disp) : null); }, [disp]);
  return { disp, box, setBox };
}

type BoxUpdate = (start: Rect, dx: number, dy: number, disp: Rect) => Rect;
interface CropRefs { box: { current: Rect | null }; disp: { current: Rect | null }; setBox: (b: Rect) => void }
interface CropPans { move: PanResponderInstance; corners: Record<Corner, PanResponderInstance> }

/** Cada gesto parte del box que había al tocar. */
function boxPan(refs: CropRefs, update: BoxUpdate): PanResponderInstance {
  let start: Rect | null = null;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start = refs.box.current; },
    onPanResponderMove: (_e, g) => {
      if (start && refs.disp.current) refs.setBox(update(start, g.dx, g.dy, refs.disp.current));
    },
  });
}

function createCropPans(refs: CropRefs): CropPans {
  const corners = Object.fromEntries(CORNERS.map((c) => [
    c, boxPan(refs, (start, dx, dy, disp) => resizeCorner(start, c, dx, dy, disp, MIN_BOX)),
  ])) as Record<Corner, PanResponderInstance>;
  return { move: boxPan(refs, moveBox), corners };
}

/** Los PanResponder se crean una vez y leen box/disp por ref. */
function useCropGestures(box: Rect | null, disp: Rect | null, setBox: (b: Rect) => void): CropPans {
  const boxRef = useRef(box); boxRef.current = box;
  const dispRef = useRef(disp); dispRef.current = disp;
  const pans = useRef<CropPans | null>(null);
  if (!pans.current) pans.current = createCropPans({ box: boxRef, disp: dispRef, setBox });
  return pans.current;
}

/** Si falla, avisa y deja el recorte abierto para reintentar o cancelar. */
function useSaveCrop(raw: RawPhoto | null, onSave: (uri: string) => void) {
  const [saving, setSaving] = useState(false);
  async function save(box: Rect, disp: Rect, imgSize: Size) {
    if (!raw || saving) return;
    setSaving(true);
    try {
      onSave(await cropResizeAndSave(raw.uri, cropBoxToPixels(box, disp, imgSize.w, imgSize.h), imgSize.w, imgSize.h));
    } catch (e) {
      console.error('[Photo] no se pudo guardar el recorte', e);
      avisoBreve(AVISO.noSeGuardo);
    } finally {
      setSaving(false);
    }
  }
  return { saving, save };
}

function CornerHandle({ box, corner, pan }: { box: Rect; corner: Corner; pan: PanResponderInstance }) {
  const p = cornerPoint(box, corner);
  return (
    <View {...pan.panHandlers} style={[styles.handle, { left: p.x - HANDLE_SIZE, top: p.y - HANDLE_SIZE }]}>
      <View style={styles.handleDot} />
    </View>
  );
}

interface ActionBarProps {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onRetry?: () => void;
}

function CropActionBar({ saving, onSave, onCancel, onRetry }: ActionBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
      <Pressable style={styles.cancelBtn} onPress={onRetry ?? onCancel} disabled={saving}>
        <Ionicons name={onRetry ? 'refresh' : 'close'} size={CROP_ICON_SIZE.action} color={colors.white} />
        <Text style={styles.cancelText}>{onRetry ? 'Reintentar' : 'Cancelar'}</Text>
      </Pressable>
      <Pressable style={styles.saveBtn} onPress={onSave} disabled={saving} accessibilityLabel="Guardar foto">
        {saving ? <ActivityIndicator size="small" color={colors.white} />
          : <><Ionicons name="checkmark" size={CROP_ICON_SIZE.action} color={colors.white} /><Text style={styles.saveText}>Guardar</Text></>}
      </Pressable>
    </View>
  );
}

export default function PhotoCropModal({ raw, onCancel, onSave, onRetry }: Props) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Size | null>(null);
  const imgSize = useImageSize(raw, onRetry ?? onCancel);
  const { disp, box, setBox } = useCropBox(stage, imgSize);
  const pans = useCropGestures(box, disp, setBox);
  const { saving, save } = useSaveCrop(raw, onSave);

  return (
    <Modal visible={!!raw} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.container}>
        <Pressable style={[styles.closeBtn, { top: insets.top + spacing.md }]} onPress={onCancel} hitSlop={spacing.xl} accessibilityLabel="Cancelar">
          <Ionicons name="close" size={CROP_ICON_SIZE.close} color={colors.white} />
        </Pressable>
        <View testID="crop-stage" style={styles.stage} onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {raw && disp && <Image source={{ uri: raw.uri }} style={[styles.image, rectToLayout(disp)]} resizeMode="cover" />}
          {box && stage && (
            <>
              <CropMask box={box} stage={stage} frameHandlers={pans.move.panHandlers} />
              {CORNERS.map((c) => <CornerHandle key={c} box={box} corner={c} pan={pans.corners[c]} />)}
            </>
          )}
        </View>
        <CropActionBar
          saving={saving}
          onSave={() => { if (box && disp && imgSize) void save(box, disp, imgSize); }}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      </View>
    </Modal>
  );
}
