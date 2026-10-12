/*
 * Si la foto de un árbol está subida al bucket. Sin Supabase a propósito: el
 * plan del reporte lo usa y el reporte se arma en un worker (#849).
 */
import { ESQUEMAS_FOTO_LOCAL } from '../queries/fotoConstantes';

/** true si la foto sigue en el celular que la sacó (`file://`, `content://`): existe pero no se subió. */
export function esFotoLocal(fotoUrl: string | null | undefined): boolean {
  if (!fotoUrl) return false;
  return ESQUEMAS_FOTO_LOCAL.some((esquema) => fotoUrl.startsWith(esquema));
}

/** La URL si la foto está subida al bucket; null si está vacía o sigue en el celular. */
export function fotoSubida(fotoUrl: string | null | undefined): string | null {
  if (!fotoUrl || esFotoLocal(fotoUrl)) return null;
  return fotoUrl;
}

/** true si el árbol tiene una foto subida al bucket (no local ni vacía). */
export function tieneFotoSubida(fotoUrl: string | null | undefined): boolean {
  return fotoSubida(fotoUrl) !== null;
}
