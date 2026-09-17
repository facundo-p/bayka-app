/**
 * Filtro y orden del listado de plantaciones. Puro: se testea sin renderizar.
 */
import { pluralizar, type Sustantivo } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import { ESTADO_PLANTACION, type PlantacionConStats } from '../../queries/plantationQueries';

const ARBOL_REGISTRADO: Sustantivo = {
  singular: 'árbol registrado',
  plural: 'árboles registrados',
};

/** `todas` es el sentinela del segmentado; el resto son estados de dominio. */
export const FILTRO_ESTADO = {
  todas: 'todas',
  activas: ESTADO_PLANTACION.activa,
  finalizadas: ESTADO_PLANTACION.finalizada,
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

/** Coincidencia case-insensitive contra lugar y temporada. */
function coincide(plantacion: PlantacionConStats, termino: string): boolean {
  const aguja = termino.trim().toLowerCase();
  if (!aguja) return true;
  return [plantacion.lugar, plantacion.periodo].some((campo) =>
    campo.toLowerCase().includes(aguja),
  );
}

function pasaEstado(plantacion: PlantacionConStats, estado: FiltroEstado): boolean {
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

/** Meta de la cabecera: tamaño del listado completo, sin filtrar. */
export function resumenPlantaciones(plantaciones: PlantacionConStats[]): string {
  const temporadas = temporadasDisponibles(plantaciones).length;
  return [
    pluralizar(plantaciones.length, SUSTANTIVO.plantacion),
    pluralizar(temporadas, SUSTANTIVO.temporada),
    pluralizar(contarArboles(plantaciones), ARBOL_REGISTRADO),
  ].join(' · ');
}
