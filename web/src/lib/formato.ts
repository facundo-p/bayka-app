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
export function etiquetaCodigoNombre({
  codigo,
  nombre,
}: {
  codigo: string;
  nombre: string;
}): string {
  return `${codigo} — ${nombre}`;
}

export const PORCENTAJE_COMPLETO = 100;

/** Porcentaje entero redondeado; 0 si el total es 0. */
export function porcentaje(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * PORCENTAJE_COMPLETO);
}

export function acotarPorcentaje(valor: number): number {
  return Math.min(PORCENTAJE_COMPLETO, Math.max(0, valor));
}

/**
 * Avance de `valor` hacia `objetivo`, en entero de 0 a 100.
 * Sin objetivo (null, 0 o negativo) no hay avance que medir: null, y cada
 * pantalla decide qué mostrar en su lugar. Superarlo cuenta como cumplido
 * (100): el excedente se lee en las cifras absolutas.
 */
export function porcentajeDeObjetivo(valor: number, objetivo: number | null): number | null {
  if (objetivo === null || objetivo <= 0) return null;
  return acotarPorcentaje(porcentaje(valor, objetivo));
}
