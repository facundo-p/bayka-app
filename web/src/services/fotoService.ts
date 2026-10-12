import { fotoSubida } from '../lib/fotoSubida';
import { supabase } from '../lib/supabase';

export { esFotoLocal, fotoSubida, tieneFotoSubida } from '../lib/fotoSubida';

/** Bucket privado de Storage donde mobile sube las fotos de árboles. */
const BUCKET_FOTOS_ARBOLES = 'tree-photos';

/** Validez del enlace firmado: 1 hora. */
const SEGUNDOS_VALIDEZ_URL = 3600;

/** De una URL completa del bucket extrae el path interno; un path directo queda igual. */
function extraerPathDeFoto(fotoUrl: string): string {
  const marcador = `/${BUCKET_FOTOS_ARBOLES}/`;
  const indice = fotoUrl.indexOf(marcador);
  const path = indice >= 0 ? fotoUrl.slice(indice + marcador.length) : fotoUrl;
  return path.split('?')[0];
}

async function firmarFoto(fotoUrl: string, download?: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS_ARBOLES)
    .createSignedUrl(
      extraerPathDeFoto(fotoUrl),
      SEGUNDOS_VALIDEZ_URL,
      download ? { download } : undefined,
    );
  if (error) throw new Error(error.message);
  return data?.signedUrl ?? null;
}

/**
 * URL firmada y temporal para ver la foto de un árbol, o null si no hay foto
 * subida (campo vacío o archivo local del dispositivo móvil sin sincronizar).
 */
export async function obtenerUrlFoto(fotoUrl: string | null | undefined): Promise<string | null> {
  const subida = fotoSubida(fotoUrl);
  return subida && firmarFoto(subida);
}

/** Como `obtenerUrlFoto`, pero la URL baja la foto como archivo con ese nombre. */
export async function obtenerUrlDescargaFoto(
  fotoUrl: string | null | undefined,
  nombreArchivo: string,
): Promise<string | null> {
  const subida = fotoSubida(fotoUrl);
  return subida && firmarFoto(subida, nombreArchivo);
}

/**
 * URLs firmadas de varias fotos subidas, en una sola llamada y en el mismo orden. Una foto
 * que Storage no firma (no existe o la policy la niega) queda en null; un error de la
 * llamada entera, también.
 */
export async function firmarFotos(fotoUrls: readonly string[]): Promise<Array<string | null>> {
  if (fotoUrls.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS_ARBOLES)
    .createSignedUrls(fotoUrls.map(extraerPathDeFoto), SEGUNDOS_VALIDEZ_URL);
  if (error || !data) return fotoUrls.map(() => null);
  return fotoUrls.map((_, indice) => {
    const firmada = data[indice];
    return firmada && !firmada.error && firmada.signedUrl ? firmada.signedUrl : null;
  });
}
