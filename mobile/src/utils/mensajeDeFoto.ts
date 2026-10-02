import { RESULTADO_FOTO, ALBUM_GALERIA, type ResultadoFoto } from '../constants/fotoAcciones';

const MENSAJES: Record<ResultadoFoto, string | null> = {
  [RESULTADO_FOTO.guardada]: `Guardada en el álbum ${ALBUM_GALERIA}`,
  // La hoja de compartir ya es el feedback.
  [RESULTADO_FOTO.compartida]: null,
  [RESULTADO_FOTO.sinPermiso]: 'Sin permiso para guardar en la galería. Activalo en Ajustes del teléfono.',
  [RESULTADO_FOTO.sinConexion]: 'Sin conexión: la foto no está en este celular. Conectate para descargarla.',
  [RESULTADO_FOTO.descargaFallida]: 'No se pudo descargar la foto. Probá de nuevo.',
  [RESULTADO_FOTO.sinArbol]: 'No se pudo identificar el árbol de esta foto.',
  [RESULTADO_FOTO.error]: 'No se pudo completar la acción. Probá de nuevo.',
};

/** Texto para avisar el resultado de guardar/compartir; null si no hay nada que avisar. */
export function mensajeDeFoto(resultado: ResultadoFoto): string | null {
  return MENSAJES[resultado];
}
