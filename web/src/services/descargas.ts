/*
 * Helpers compartidos de descarga de archivos y de nombres de archivo.
 * Único lugar del slug y del enlace temporal de descarga: los serializadores
 * (KML, CSV, XLSX) solo arman el contenido.
 */

/** Slug seguro para nombres de archivo: minúsculas, sin acentos ni símbolos. */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Nombre descriptivo `<prefijo>-<lugar>-<periodo>.<extension>`, omitiendo
 *  partes vacías tras el slug. */
export function nombreArchivoDescarga(
  prefijo: string,
  lugar: string,
  periodo: string,
  extension: string,
): string {
  const partes = [aSlug(lugar), aSlug(periodo)].filter(Boolean);
  return `${prefijo}-${partes.join('-')}.${extension}`;
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
