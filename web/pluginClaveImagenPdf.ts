/**
 * Parche de react-pdf para el navegador (#875). La clave con la que reusa una
 * imagen entre hojas se calcula después de `Buffer.isBuffer(source)`: sin
 * `Buffer`, esa llamada lanza, react-pdf se traga el error y embebe el logo del
 * encabezado de nuevo en cada hoja. No se define un `Buffer` global porque
 * storage-js de Supabase, al verlo, lo usaría para codificar en base64.
 */
import type { Plugin } from 'vite';

const LLAMADA = 'Buffer.isBuffer(source)';
const LLAMADA_PROTEGIDA = `(typeof Buffer !== 'undefined' && ${LLAMADA})`;

/** En dev, react-pdf llega pre-empaquetado en `.vite/deps/@react-pdf_renderer.js`. */
const MODULO_REACT_PDF = 'react-pdf';

/** El código con la llamada protegida, o null si no la tiene. */
export function protegerClaveDeImagen(codigo: string): string | null {
  return codigo.includes(LLAMADA) ? codigo.replaceAll(LLAMADA, LLAMADA_PROTEGIDA) : null;
}

/** Va en `plugins` y también en `worker.plugins`: el reporte de árboles se arma en un worker. */
export const pluginClaveImagenPdf = (): Plugin => ({
  name: 'clave-imagen-pdf',
  transform(codigo, id) {
    if (!id.includes(MODULO_REACT_PDF)) return null;
    const protegido = protegerClaveDeImagen(codigo);
    // El reemplazo no cambia de renglón: el sourcemap anterior sigue sirviendo.
    return protegido && { code: protegido, map: null };
  },
});
