/** Formatea un entero con separador de miles es-AR, ej. 12345 → "12.345". */
export function formatearEntero(valor: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor);
}

/**
 * Concuerda un sustantivo con su cantidad, ya formateada, ej. "1 plantación"
 * o "1.260 árboles".
 */
export function pluralizar(cantidad: number, singular: string, plural: string): string {
  return `${formatearEntero(cantidad)} ${cantidad === 1 ? singular : plural}`;
}
