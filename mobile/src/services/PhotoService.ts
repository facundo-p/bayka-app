import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat, Action } from 'expo-image-manipulator';
import type { PixelCrop } from '../utils/cropGeometry';

const MAX_LONG_SIDE = 1600;

export interface RawPhoto {
  uri: string;
  width: number;
  height: number;
}

// CRITICAL: always copy from the temp picker URI to permanent Paths.document —
// picker temp URIs may be gone after app restart or OS memory pressure.
function saveToPhotos(srcUri: string): string {
  const filename = `photo_${Date.now()}.jpg`;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  const dest = new File(dir, filename);
  new File(srcUri).copy(dest);
  return dest.uri;
}

/**
 * Recorta (si `pixelCrop` no es null), redimensiona el lado mayor a
 * MAX_LONG_SIDE y guarda como JPEG permanente. Paso único: el recorte es
 * opcional y el guardado es atómico.
 */
export async function cropResizeAndSave(
  uri: string,
  pixelCrop: PixelCrop | null,
  origWidth: number,
  origHeight: number
): Promise<string> {
  const actions: Action[] = [];
  if (pixelCrop) actions.push({ crop: pixelCrop });
  const w = pixelCrop ? pixelCrop.width : origWidth;
  const h = pixelCrop ? pixelCrop.height : origHeight;
  const isLandscape = w >= h;
  actions.push({ resize: isLandscape ? { width: MAX_LONG_SIDE } : { height: MAX_LONG_SIDE } });
  const result = await manipulateAsync(uri, actions, { compress: 0.85, format: SaveFormat.JPEG });
  return saveToPhotos(result.uri);
}

/** Captura con cámara SIN procesar (para el paso de recorte). null si cancela/sin permiso. */
export async function launchCameraRaw(): Promise<RawPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    // allowsEditing: paso de recorte nativo tras capturar. En Android el
    // recorte es libre; lo recortado es lo que se guarda. Cancelar degrada sin crash.
    allowsEditing: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
}

/** Selección de galería SIN procesar (para el paso de recorte). */
export async function launchGalleryRaw(): Promise<RawPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    // allowsEditing: permite recortar la imagen elegida antes de guardarla.
    allowsEditing: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
}
