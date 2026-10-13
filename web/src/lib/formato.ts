import { ESPECIE_NO_RESUELTA, NOMBRE_SIN_IDENTIFICAR } from '../queries/especiesConstantes';

/** Dato ausente en tablas, paneles y documentos. */
export const SIN_DATO = '—';

/** Decimales de lat/lng en el detalle del árbol y en su ficha PDF (~10 cm). */
export const DECIMALES_GPS = 6;

/** «-27.360120, -55.897440». */
export function formatearCoordenadas(lat: number, lng: number, decimales = DECIMALES_GPS): string {
  return `${lat.toFixed(decimales)}, ${lng.toFixed(decimales)}`;
}

/** «± 4 m»: la precisión del punto GPS, al metro. */
export function formatearPrecision(metros: number): string {
  return `± ${Math.round(metros)} m`;
}

/** Separador de «código · nombre» y de las partes de un rótulo. */
export const SEPARADOR_PUNTO = ' · ';

/** null = N/N. */
export type EspecieRotulable = { especieCodigo: string | null; especieNombre: string | null };

/** "código · nombre" de la especie, con N/N si el árbol no la tiene. */
export function etiquetaEspecie({ especieCodigo, especieNombre }: EspecieRotulable): string {
  const codigo = especieCodigo ?? ESPECIE_NO_RESUELTA;
  const nombre = especieNombre ?? NOMBRE_SIN_IDENTIFICAR;
  return `${codigo}${SEPARADOR_PUNTO}${nombre}`;
}

/** null si no se sabe quién lo registró o el perfil no tiene nombre. */
export function nombreTecnicoDe(
  arbol: { usuarioRegistro: string | null },
  nombres: ReadonlyMap<string, string>,
): string | null {
  return (arbol.usuarioRegistro && nombres.get(arbol.usuarioRegistro)) || null;
}

/** Formatea un entero con separador de miles es-AR, ej. 12345 → "12.345". */
export function formatearEntero(valor: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor);
}

/** Las dos formas de lo que concuerda con una cantidad, ej. árbol/árboles. */
export interface Sustantivo {
  singular: string;
  plural: string;
}

/** La forma que concuerda con la cantidad, sin la cantidad. */
export function concordar(cantidad: number, { singular, plural }: Sustantivo): string {
  return cantidad === 1 ? singular : plural;
}

/**
 * Concuerda un sustantivo con su cantidad, ya formateada, ej. "1 plantación"
 * o "1.260 árboles".
 */
export function pluralizar(cantidad: number, sustantivo: Sustantivo): string {
  return `${formatearEntero(cantidad)} ${concordar(cantidad, sustantivo)}`;
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

/** Bytes de un KB y de un MB, en base 10 como los muestra el sistema. */
export const BYTES = { kb: 1000, mb: 1000 * 1000 } as const;

/** Debajo de esto el MB lleva un decimal: «1,4 MB» dice más que «1 MB». */
const MB_CON_DECIMAL = 10;

function formatearDecimal(valor: number, decimales: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: decimales }).format(valor);
}

/** Tamaño de un archivo, ej. «340 KB», «1,4 MB», «12 MB». */
export function formatearPeso(bytes: number): string {
  const mb = bytes / BYTES.mb;
  if (mb < 1) return `${formatearEntero(Math.max(1, bytes / BYTES.kb))} KB`;
  return `${formatearDecimal(mb, mb < MB_CON_DECIMAL ? 1 : 0)} MB`;
}
