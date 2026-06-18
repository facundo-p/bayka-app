/** Formatea un entero con separador de miles es-AR, ej. 12345 → "12.345". */
export function formatearEntero(valor: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor);
}
