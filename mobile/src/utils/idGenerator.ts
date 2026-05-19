/**
 * Generates the SubID for a tree.
 * Format: {parcelaCodigo}{grupoCodigo}{especieCodigo}{posicion}
 * Examples:
 *   generateSubId('LP1', 'L23B', 'ANC', 12) → 'LP1L23BANC12'
 *   generateSubId('MP3', 'L1', 'NN', 5)    → 'MP3L1NN5'
 *
 * NOTE: Signature changed in Phase 15 (v1.1) — old 3-arg form removed (D-16).
 * Callers in TreeRepository / SubGroupRepository will not compile until Phase 16.
 */
export function generateSubId(
  parcelaCodigo: string,
  grupoCodigo: string,
  especieCodigo: string,
  posicion: number
): string {
  return `${parcelaCodigo}${grupoCodigo}${especieCodigo}${posicion}`;
}
