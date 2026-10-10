import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat, Action } from 'expo-image-manipulator';
import type { PixelCrop } from '../utils/cropGeometry';

/** Toda foto guardada es un JPEG cuadrado de este lado (#831). */
export const PHOTO_SIDE = 1200;
const PHOTO_JPEG_QUALITY = 0.85;

export interface RawPhoto {
  uri: string;
  width: number;
  height: number;
}

function carpetaDeFotos(): Directory {
  return new Directory(Paths.document, 'photos');
}

// CRITICAL: always copy from the temp picker URI to permanent Paths.document —
// picker temp URIs may be gone after app restart or OS memory pressure.
function saveToPhotos(srcUri: string): string {
  const filename = `photo_${Date.now()}.jpg`;
  const dir = carpetaDeFotos();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  const dest = new File(dir, filename);
  new File(srcUri).copy(dest);
  return dest.uri;
}

/**
 * La app guarda las fotos sueltas en su carpeta, sin subcarpetas. Chequear solo el
 * prefijo deja pasar `photos/../otra-cosa` (#527); se decodifica antes porque
 * `%2e%2e` también sube de carpeta.
 */
function esArchivoSueltoDe(carpeta: string, uri: string): boolean {
  if (!uri.startsWith(carpeta)) return false;
  let nombre: string;
  try {
    nombre = decodeURIComponent(uri.slice(carpeta.length));
  } catch {
    return false;
  }
  return nombre !== '' && nombre !== '.' && nombre !== '..' && !/[\\/]/.test(nombre);
}

/** Con barra final: el uri del directorio puede venir con o sin ella. */
function uriDeLaCarpetaDeFotos(): string | null {
  try {
    return carpetaDeFotos().uri.replace(/\/?$/, '/');
  } catch (e) {
    // El borrado corre después del commit: una excepción acá haría fallar una
    // operación de datos que ya se hizo.
    console.error('[Photo] no se pudo resolver la carpeta de fotos', e);
    return null;
  }
}

/** Archivo de la carpeta propia de fotos, el único que `borrarFotosLocales` borra. */
export function esFotoDeLaApp(uri: string): boolean {
  const carpeta = uriDeLaCarpetaDeFotos();
  return carpeta !== null && esArchivoSueltoDe(carpeta, uri);
}

/** Bytes de una foto del dispositivo; 0 si no existe o no se puede leer. */
export function pesoDeFotoLocal(uri: string): number {
  try {
    const archivo = new File(uri);
    return archivo.exists ? archivo.size ?? 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Borra archivos de fotos del device. Best-effort: un archivo que no se puede borrar
 * se loguea y no corta el resto.
 *
 * Solo toca la carpeta propia de fotos: un path de Storage, una URL o un
 * `content://` de la galería no son archivos de la app.
 */
export function borrarFotosLocales(uris: readonly string[]): void {
  const carpeta = uriDeLaCarpetaDeFotos();
  if (!carpeta) return;
  for (const uri of uris) {
    if (!esArchivoSueltoDe(carpeta, uri)) continue;
    try {
      const archivo = new File(uri);
      if (archivo.exists) archivo.delete();
    } catch (e) {
      console.error('[Photo] no se pudo borrar', uri, e);
    }
  }
}

/** Recorta el cuadrado, lo lleva a PHOTO_SIDE × PHOTO_SIDE y lo guarda como JPEG permanente. */
export async function cropResizeAndSave(uri: string, pixelCrop: PixelCrop): Promise<string> {
  if (!(pixelCrop.width > 0 && pixelCrop.height > 0)) {
    throw new Error(`[Photo] recorte vacío (${pixelCrop.width}×${pixelCrop.height}): ¿la imagen no informó su tamaño?`);
  }
  const actions: Action[] = [
    { crop: pixelCrop },
    { resize: { width: PHOTO_SIDE, height: PHOTO_SIDE } },
  ];
  const result = await manipulateAsync(uri, actions, { compress: PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG });
  return saveToPhotos(result.uri);
}

/** Selección de galería sin procesar: el recorte cuadrado lo hace la app, no el picker. */
export async function launchGalleryRaw(): Promise<RawPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 };
}
