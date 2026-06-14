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

// CRITICAL (Pitfall 1): Always copy from temp picker URI to permanent Paths.document.
// Picker temp URIs may be gone after app restart or OS memory pressure.
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

// Pitfall 3: quality 1 at capture; manipulateAsync handles compression (single-pass JPEG).
async function resizeAndSaveToDocument(
  tempUri: string,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const resize = width !== undefined ? { width } : { height };
  const result = await manipulateAsync(tempUri, [{ resize }], { compress: 0.85, format: SaveFormat.JPEG });
  return saveToPhotos(result.uri);
}

/**
 * Recorta (si `pixelCrop` no es null), redimensiona el lado mayor a MAX_LONG_SIDE
 * y guarda como JPEG permanente. Camino único del cropper de captura (#167):
 * un solo paso — el recorte es opcional y el guardado es atómico.
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
    allowsEditing: false,
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
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
}

/** Captura + procesado en un paso (sin recorte interactivo). Conveniencia/legacy. */
export async function launchCamera(): Promise<string | null> {
  const raw = await launchCameraRaw();
  if (!raw) return null;
  const isLandscape = raw.width >= raw.height;
  return resizeAndSaveToDocument(raw.uri, isLandscape ? MAX_LONG_SIDE : undefined, isLandscape ? undefined : MAX_LONG_SIDE);
}

/** Galería + procesado en un paso (sin recorte interactivo). Conveniencia/legacy. */
export async function launchGallery(): Promise<string | null> {
  const raw = await launchGalleryRaw();
  if (!raw) return null;
  const isLandscape = raw.width >= raw.height;
  return resizeAndSaveToDocument(raw.uri, isLandscape ? MAX_LONG_SIDE : undefined, isLandscape ? undefined : MAX_LONG_SIDE);
}
