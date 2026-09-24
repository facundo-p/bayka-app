/**
 * Generates the SubID for a tree.
 * Format: {parcelaCodigo}{grupoCodigo}{especieCodigo}{posicion}
 * Examples:
 *   generateSubId('LP1', 'L23B', 'ANC', 12) → 'LP1L23BANC12'
 *   generateSubId('MP3', 'L1', 'NN', 5)    → 'MP3L1NN5'
 */
export function generateSubId(
  parcelaCodigo: string,
  grupoCodigo: string,
  especieCodigo: string,
  posicion: number
): string {
  return `${parcelaCodigo}${grupoCodigo}${especieCodigo}${posicion}`;
}

/**
 * Segmento de especie de un SubID armado con `generateSubId` con ese prefijo (parcela + grupo) y
 * esa posición; null si el SubID no calza.
 */
export function especieDelSubId(subId: string, prefijo: string, posicion: number): string | null {
  const sufijo = String(posicion);
  if (!subId.startsWith(prefijo) || !subId.endsWith(sufijo)) return null;
  return subId.slice(prefijo.length, subId.length - sufijo.length) || null;
}
