/** Formatea un entero con separador de miles es-AR, ej. 12345 → "12.345". */
export function formatearEntero(valor: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor);
}

/** El sustantivo que concuerda con la cantidad, sin la cantidad. */
export function concordar(cantidad: number, singular: string, plural: string): string {
  return cantidad === 1 ? singular : plural;
}

/**
 * Concuerda un sustantivo con su cantidad, ya formateada, ej. "1 plantación"
 * o "1.260 árboles".
 */
export function pluralizar(cantidad: number, singular: string, plural: string): string {
  return `${formatearEntero(cantidad)} ${concordar(cantidad, singular, plural)}`;
}

/** Opción de un select de entidades con código, ej. "P1 — Norte". */
export function etiquetaCodigoNombre({ codigo, nombre }: { codigo: string; nombre: string }): string {
  return `${codigo} — ${nombre}`;
}
