import { supabase } from '../lib/supabase';

/** Bucket privado de Storage donde mobile sube las fotos de árboles. */
const BUCKET_FOTOS_ARBOLES = 'tree-photos';

/** Validez del enlace firmado: 1 hora. */
const SEGUNDOS_VALIDEZ_URL = 3600;

/** Esquemas de archivo local de mobile: la foto todavía no se subió al bucket. */
const ESQUEMAS_LOCALES = ['file://', 'content://'];

function esFotoLocal(fotoUrl: string): boolean {
  return ESQUEMAS_LOCALES.some((esquema) => fotoUrl.startsWith(esquema));
}

/** true si el árbol tiene una foto subida al bucket (no local ni vacía). */
export function tieneFotoSubida(fotoUrl: string | null | undefined): fotoUrl is string {
  if (!fotoUrl) return false;
  return !esFotoLocal(fotoUrl);
}

/** De una URL completa del bucket extrae el path interno; un path directo queda igual. */
function extraerPathDeFoto(fotoUrl: string): string {
  const marcador = `/${BUCKET_FOTOS_ARBOLES}/`;
  const indice = fotoUrl.indexOf(marcador);
  const path = indice >= 0 ? fotoUrl.slice(indice + marcador.length) : fotoUrl;
  return path.split('?')[0];
}

/**
 * URL firmada y temporal para ver la foto de un árbol, o null si no hay foto
 * subida (campo vacío o archivo local del dispositivo móvil sin sincronizar).
 */
export async function obtenerUrlFoto(fotoUrl: string | null | undefined): Promise<string | null> {
  if (!tieneFotoSubida(fotoUrl)) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS_ARBOLES)
    .createSignedUrl(extraerPathDeFoto(fotoUrl), SEGUNDOS_VALIDEZ_URL);
  if (error) throw new Error(error.message);
  return data?.signedUrl ?? null;
}
