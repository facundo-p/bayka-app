/*
 * Helpers compartidos de descarga de archivos y de nombres de archivo.
 * Único lugar del slug y del enlace temporal de descarga: los serializadores
 * (KML, CSV, XLSX) solo arman el contenido.
 */

import { normalizarTexto } from '../lib/normalizarTexto';

/** Slug seguro para nombres de archivo: minúsculas, sin acentos ni símbolos. */
export function aSlug(texto: string): string {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Nombre descriptivo `<prefijo>-<lugar>-<periodo>[-<detalle>].<extension>`,
 *  omitiendo partes vacías tras el slug. */
export function nombreArchivoDescarga(
  prefijo: string,
  lugar: string,
  periodo: string,
  extension: string,
  detalle = '',
): string {
  const partes = [aSlug(lugar), aSlug(periodo), aSlug(detalle)].filter(Boolean);
  return `${prefijo}-${partes.join('-')}.${extension}`;
}

/** Nombre `foto-<lugar>-<periodo>-<subId>.jpg`; mismo formato que la app. */
export function nombreArchivoFoto(lugar: string, periodo: string, subId: string): string {
  const partes = [aSlug(lugar), aSlug(periodo), aSlug(subId)].filter(Boolean);
  return partes.length > 0 ? `foto-${partes.join('-')}.jpg` : 'foto.jpg';
}

/** Descarga una URL ya firmada con `download`: Storage la sirve como adjunto, porque el
 *  atributo `download` se ignora en otro origen. */
export function descargarDesdeUrl(url: string, nombreArchivo: string): void {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
}

/** Dispara la descarga de un Blob como archivo vía un enlace temporal. */
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Dispara la descarga de `contenido` como archivo de texto. */
export function descargarTexto(contenido: string, nombreArchivo: string, tipoMime: string): void {
  descargarBlob(new Blob([contenido], { type: tipoMime }), nombreArchivo);
}
