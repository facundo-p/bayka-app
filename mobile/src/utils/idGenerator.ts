/**
 * Generates the SubID for a tree.
 * Format: {subgrupoCodigo}{especieCodigo}{posicion}
 * Examples:
 *   generateSubId('L23B', 'ANC', 12) → 'L23BANC12'
 *   generateSubId('L23B', 'NN', 5)   → 'L23BNN5'
 */
export function generateSubId(
  subgrupoCodigo: string,
  especieCodigo: string,
  posicion: number
): string {
  return `${subgrupoCodigo}${especieCodigo}${posicion}`;
}
