/**
 * Guardar en la galería y compartir la foto de un árbol. Una foto que solo está en la nube
 * se baja primero. El archivo se copia a cache con nombre legible: es el que ve la galería
 * o la hoja de compartir.
 */
import NetInfo from '@react-native-community/netinfo';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { getDatosNombreDeFoto } from '../queries/treeQueries';
import { estaConectado } from './conexion';
import { descargarFotoRemota } from './sync/photoService';
import { isRemoteUri } from '../utils/photoUri';
import { nombreDeFoto } from '../utils/nombreDeFoto';
import { ALBUM_GALERIA, RESULTADO_FOTO, type ResultadoFoto } from '../constants/fotoAcciones';

const MIME_JPEG = 'image/jpeg';
const PERMISO_FOTOS = 'photo';

export type FotoLocal =
  | { ok: true; uri: string; /** Solo si se bajó recién: el visor pasa a mostrar el archivo local. */ descargadaAhora: boolean }
  | { ok: false; resultado: ResultadoFoto };

/** Uri local de la foto, bajándola si está en la nube; si no se puede, el motivo. */
export async function asegurarFotoLocal(uri: string, treeId: string | undefined): Promise<FotoLocal> {
  if (!isRemoteUri(uri)) return { ok: true, uri, descargadaAhora: false };
  if (!treeId) return { ok: false, resultado: RESULTADO_FOTO.sinArbol };
  if (!estaConectado(await NetInfo.fetch())) return { ok: false, resultado: RESULTADO_FOTO.sinConexion };
  const local = await descargarFotoRemota(treeId, uri);
  return local
    ? { ok: true, uri: local, descargadaAhora: true }
    : { ok: false, resultado: RESULTADO_FOTO.descargaFallida };
}

/** Copia la foto a cache con su nombre legible, pisando una copia anterior. */
async function copiarConNombre(uriLocal: string, treeId: string | undefined): Promise<File> {
  const datos = treeId ? await getDatosNombreDeFoto(treeId) : null;
  const copia = new File(Paths.cache, nombreDeFoto(datos?.lugar ?? '', datos?.periodo ?? '', datos?.subId ?? ''));
  if (copia.exists) copia.delete();
  new File(uriLocal).copy(copia);
  return copia;
}

/**
 * Guarda la foto en el álbum «Bayka». Pide permiso de lectura de fotos, no solo de escritura:
 * buscar el álbum exige leer (Android 13+: READ_MEDIA_IMAGES; 10-12: READ/WRITE_EXTERNAL_STORAGE).
 * El álbum se resuelve antes de crear el asset: si falla, no queda una foto suelta que un
 * reintento duplicaría.
 */
export async function guardarFotoEnGaleria(uriLocal: string, treeId: string | undefined): Promise<ResultadoFoto> {
  const permiso = await MediaLibrary.requestPermissionsAsync(false, [PERMISO_FOTOS]);
  if (!permiso.granted) return RESULTADO_FOTO.sinPermiso;
  const album = await MediaLibrary.getAlbumAsync(ALBUM_GALERIA);
  const copia = await copiarConNombre(uriLocal, treeId);
  try {
    const asset = await MediaLibrary.createAssetAsync(copia.uri);
    if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    else await MediaLibrary.createAlbumAsync(ALBUM_GALERIA, asset, false);
  } finally {
    if (copia.exists) copia.delete();
  }
  return RESULTADO_FOTO.guardada;
}

/** Abre la hoja de compartir. La copia no se borra: la app destino puede leerla después de que resuelva. */
export async function compartirFoto(uriLocal: string, treeId: string | undefined): Promise<ResultadoFoto> {
  const copia = await copiarConNombre(uriLocal, treeId);
  await Sharing.shareAsync(copia.uri, { mimeType: MIME_JPEG, dialogTitle: 'Compartir foto' });
  return RESULTADO_FOTO.compartida;
}
