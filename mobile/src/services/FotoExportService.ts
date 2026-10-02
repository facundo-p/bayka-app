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

export interface FotoLocal {
  uri: string;
  /** Solo si la foto se bajó recién: el visor pasa a mostrar el archivo local. */
  descargadaAhora: boolean;
}

/** Uri local de la foto, bajándola si está en la nube; null sin conexión o si la descarga falla. */
export async function asegurarFotoLocal(uri: string, treeId: string | undefined): Promise<FotoLocal | null> {
  if (!isRemoteUri(uri)) return { uri, descargadaAhora: false };
  if (!treeId || !estaConectado(await NetInfo.fetch())) return null;
  const local = await descargarFotoRemota(treeId, uri);
  return local ? { uri: local, descargadaAhora: true } : null;
}

/** Copia la foto a cache con su nombre legible, pisando una copia anterior. */
async function copiarConNombre(uriLocal: string, treeId: string | undefined): Promise<File> {
  const datos = treeId ? await getDatosNombreDeFoto(treeId) : null;
  const nombre = datos ? nombreDeFoto(datos.lugar, datos.periodo, datos.subId) : nombreDeFoto('', '', treeId ?? '');
  const copia = new File(Paths.cache, nombre);
  if (copia.exists) copia.delete();
  new File(uriLocal).copy(copia);
  return copia;
}

/** Guarda la foto en el álbum «Bayka»; pide permiso la primera vez. */
export async function guardarFotoEnGaleria(uriLocal: string, treeId: string | undefined): Promise<ResultadoFoto> {
  // writeOnly: alcanza para guardar y no pide acceso a las demás fotos del teléfono.
  const permiso = await MediaLibrary.requestPermissionsAsync(true);
  if (!permiso.granted) return RESULTADO_FOTO.sinPermiso;
  const copia = await copiarConNombre(uriLocal, treeId);
  const asset = await MediaLibrary.createAssetAsync(copia.uri);
  const album = await MediaLibrary.getAlbumAsync(ALBUM_GALERIA);
  if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  else await MediaLibrary.createAlbumAsync(ALBUM_GALERIA, asset, false);
  return RESULTADO_FOTO.guardada;
}

/** Abre la hoja de compartir del sistema con la foto. */
export async function compartirFoto(uriLocal: string, treeId: string | undefined): Promise<ResultadoFoto> {
  const copia = await copiarConNombre(uriLocal, treeId);
  await Sharing.shareAsync(copia.uri, { mimeType: MIME_JPEG, dialogTitle: 'Compartir foto' });
  return RESULTADO_FOTO.compartida;
}
