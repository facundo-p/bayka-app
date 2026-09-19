/**
 * Filtro y orden del listado de plantaciones. Puro: se testea sin renderizar.
 */
import { pluralizar, type Sustantivo } from '../../lib/formato';
import { coincideBusqueda } from '../../lib/normalizarTexto';
import { SUSTANTIVO } from '../../lib/sustantivos';
import {
  esArchivada,
  ESTADO_PLANTACION,
  sinArchivadas,
  type PlantacionConStats,
} from '../../queries/plantationQueries';

const ARBOL_REGISTRADO: Sustantivo = {
  singular: 'árbol registrado',
  plural: 'árboles registrados',
};

/** `todas` y `archivadas` son del segmentado; el resto son estados de dominio. Las archivadas
 *  solo aparecen en su filtro, también fuera de `todas` (#477). */
export const FILTRO_ESTADO = {
  todas: 'todas',
  activas: ESTADO_PLANTACION.activa,
  finalizadas: ESTADO_PLANTACION.finalizada,
  archivadas: 'archivadas',
} as const;

export type FiltroEstado = (typeof FILTRO_ESTADO)[keyof typeof FILTRO_ESTADO];

export const ORDEN_PLANTACION = {
  arboles: 'arboles',
  lugar: 'lugar',
  creada: 'creada',
} as const;

export type OrdenPlantacion = (typeof ORDEN_PLANTACION)[keyof typeof ORDEN_PLANTACION];

/** `temporada` vacía = todas (el Select no tiene sentinela propio). */
export const TEMPORADA_TODAS = '';

export type FiltrosPlantaciones = {
  busqueda: string;
  estado: FiltroEstado;
  temporada: string;
  orden: OrdenPlantacion;
};

/** Los filtros de la barra, sin el texto del buscador. */
export type FiltrosBarraPlantaciones = Omit<FiltrosPlantaciones, 'busqueda'>;

export const FILTROS_INICIALES_PLANTACIONES: FiltrosBarraPlantaciones = {
  estado: FILTRO_ESTADO.todas,
  temporada: TEMPORADA_TODAS,
  orden: ORDEN_PLANTACION.arboles,
};

/** Temporadas presentes en el dataset, de la más reciente a la más vieja. */
export function temporadasDisponibles(plantaciones: PlantacionConStats[]): string[] {
  const unicas = new Set(plantaciones.map((plantacion) => plantacion.periodo).filter(Boolean));
  return [...unicas].sort((a, b) => b.localeCompare(a, 'es'));
}

/** Coincidencia contra lugar y temporada, sin distinguir mayúsculas ni tildes. */
function coincide(plantacion: PlantacionConStats, termino: string): boolean {
  return coincideBusqueda([plantacion.lugar, plantacion.periodo], termino);
}

function pasaEstado(plantacion: PlantacionConStats, estado: FiltroEstado): boolean {
  if (estado === FILTRO_ESTADO.archivadas) return esArchivada(plantacion);
  if (esArchivada(plantacion)) return false;
  return estado === FILTRO_ESTADO.todas || plantacion.estado === estado;
}

function pasaTemporada(plantacion: PlantacionConStats, temporada: string): boolean {
  return temporada === TEMPORADA_TODAS || plantacion.periodo === temporada;
}

/** Comparadores por criterio; los conteos y las fechas van de mayor a menor. */
const COMPARADOR: Record<
  OrdenPlantacion,
  (a: PlantacionConStats, b: PlantacionConStats) => number
> = {
  [ORDEN_PLANTACION.arboles]: (a, b) => b.arboles - a.arboles,
  [ORDEN_PLANTACION.lugar]: (a, b) => a.lugar.localeCompare(b.lugar, 'es'),
  [ORDEN_PLANTACION.creada]: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

/** Desempata por lugar para que el orden sea estable entre renders. */
function comparar(orden: OrdenPlantacion) {
  return (a: PlantacionConStats, b: PlantacionConStats) =>
    COMPARADOR[orden](a, b) || a.lugar.localeCompare(b.lugar, 'es');
}

export function filtrarPlantaciones(
  plantaciones: PlantacionConStats[],
  { busqueda, estado, temporada, orden }: FiltrosPlantaciones,
): PlantacionConStats[] {
  return plantaciones
    .filter(
      (plantacion) =>
        coincide(plantacion, busqueda) &&
        pasaEstado(plantacion, estado) &&
        pasaTemporada(plantacion, temporada),
    )
    .sort(comparar(orden));
}

export function contarArboles(plantaciones: PlantacionConStats[]): number {
  return plantaciones.reduce((total, plantacion) => total + plantacion.arboles, 0);
}

/** Meta de la cabecera: tamaño del listado completo, sin filtrar ni contar las archivadas. */
export function resumenPlantaciones(todas: PlantacionConStats[]): string {
  const plantaciones = sinArchivadas(todas);
  const temporadas = temporadasDisponibles(plantaciones).length;
  return [
    pluralizar(plantaciones.length, SUSTANTIVO.plantacion),
    pluralizar(temporadas, SUSTANTIVO.temporada),
    pluralizar(contarArboles(plantaciones), ARBOL_REGISTRADO),
  ].join(' · ');
}
