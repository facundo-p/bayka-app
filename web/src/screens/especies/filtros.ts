/**
 * Filtro y orden del catálogo de especies. Puro: se testea sin renderizar.
 */
import { formatearEntero, pluralizar, type Sustantivo } from '../../lib/formato';
import type { EspecieConCatalogoUso } from '../../queries/especieQueries';

const ESPECIE_NATIVA: Sustantivo = { singular: 'especie nativa', plural: 'especies nativas' };

export const USO_ESPECIE = {
  todas: 'todas',
  enUso: 'en-uso',
  sinUso: 'sin-uso',
} as const;

export type UsoEspecie = (typeof USO_ESPECIE)[keyof typeof USO_ESPECIE];

export const ORDEN_ESPECIE = {
  arboles: 'arboles',
  plantaciones: 'plantaciones',
  codigo: 'codigo',
} as const;

export type OrdenEspecie = (typeof ORDEN_ESPECIE)[keyof typeof ORDEN_ESPECIE];

export type FiltrosEspecies = {
  busqueda: string;
  uso: UsoEspecie;
  orden: OrdenEspecie;
};

/** Los filtros de la barra, sin el texto del buscador. */
export type FiltrosBarraEspecies = Omit<FiltrosEspecies, 'busqueda'>;

export const FILTROS_INICIALES_ESPECIES: FiltrosBarraEspecies = {
  uso: USO_ESPECIE.todas,
  orden: ORDEN_ESPECIE.arboles,
};

/** Una especie sin uso: no habilitada en ninguna plantación y sin árboles. */
export function sinUso(especie: EspecieConCatalogoUso): boolean {
  return especie.plantaciones === 0 && especie.arboles === 0;
}

/** Coincidencia case-insensitive contra nombre, código o nombre científico. */
function coincide(especie: EspecieConCatalogoUso, termino: string): boolean {
  const aguja = termino.trim().toLowerCase();
  if (!aguja) return true;
  return [especie.nombre, especie.codigo, especie.nombreCientifico ?? ''].some((campo) =>
    campo.toLowerCase().includes(aguja),
  );
}

function pasaUso(especie: EspecieConCatalogoUso, uso: UsoEspecie): boolean {
  if (uso === USO_ESPECIE.enUso) return !sinUso(especie);
  if (uso === USO_ESPECIE.sinUso) return sinUso(especie);
  return true;
}

/** Comparadores por criterio; los conteos van de mayor a menor. */
const COMPARADOR: Record<
  OrdenEspecie,
  (a: EspecieConCatalogoUso, b: EspecieConCatalogoUso) => number
> = {
  [ORDEN_ESPECIE.arboles]: (a, b) => b.arboles - a.arboles,
  [ORDEN_ESPECIE.plantaciones]: (a, b) => b.plantaciones - a.plantaciones,
  [ORDEN_ESPECIE.codigo]: (a, b) => a.codigo.localeCompare(b.codigo, 'es'),
};

/** Desempata por código para que el orden sea estable entre renders. */
function comparar(orden: OrdenEspecie) {
  return (a: EspecieConCatalogoUso, b: EspecieConCatalogoUso) =>
    COMPARADOR[orden](a, b) || a.codigo.localeCompare(b.codigo, 'es');
}

export function filtrarEspecies(
  catalogo: EspecieConCatalogoUso[],
  { busqueda, uso, orden }: FiltrosEspecies,
): EspecieConCatalogoUso[] {
  return catalogo
    .filter((especie) => coincide(especie, busqueda) && pasaUso(especie, uso))
    .sort(comparar(orden));
}

/** Cuántas especies del catálogo tienen algún uso (para la meta de la cabecera). */
export function contarEnUso(catalogo: EspecieConCatalogoUso[]): number {
  return catalogo.filter((especie) => !sinUso(especie)).length;
}

/** Meta de la cabecera: tamaño del catálogo y cuántas están en uso. */
export function metaCatalogo(catalogo: EspecieConCatalogoUso[]): string {
  const enUso = formatearEntero(contarEnUso(catalogo));
  return `Catálogo global · ${pluralizar(catalogo.length, ESPECIE_NATIVA)} · ${enUso} en uso`;
}

export function contarArboles(catalogo: EspecieConCatalogoUso[]): number {
  return catalogo.reduce((total, especie) => total + especie.arboles, 0);
}
