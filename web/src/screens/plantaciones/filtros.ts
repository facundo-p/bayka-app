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
import type { PerfilResumen } from '../../queries/usuarioQueries';

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

/** `visiblePor` vacío = sin filtrar por técnico. */
export const TECNICO_TODOS = '';

/** Visibilidad en la app móvil (`visible_in_app`). */
export const FILTRO_VISIBLES = {
  todas: 'todas',
  si: 'si',
  no: 'no',
} as const;

export type FiltroVisibles = (typeof FILTRO_VISIBLES)[keyof typeof FILTRO_VISIBLES];

export type FiltrosPlantaciones = {
  busqueda: string;
  estado: FiltroEstado;
  temporada: string;
  /** Id del técnico asignado, o `TECNICO_TODOS`. */
  visiblePor: string;
  visibles: FiltroVisibles;
  orden: OrdenPlantacion;
};

/** Los filtros de la barra, sin el texto del buscador. */
export type FiltrosBarraPlantaciones = Omit<FiltrosPlantaciones, 'busqueda'>;

export const FILTROS_INICIALES_PLANTACIONES: FiltrosBarraPlantaciones = {
  estado: FILTRO_ESTADO.todas,
  temporada: TEMPORADA_TODAS,
  visiblePor: TECNICO_TODOS,
  visibles: FILTRO_VISIBLES.todas,
  orden: ORDEN_PLANTACION.arboles,
};

/** Temporadas presentes en el dataset, de la más reciente a la más vieja. */
export function temporadasDisponibles(plantaciones: PlantacionConStats[]): string[] {
  const unicas = new Set(plantaciones.map((plantacion) => plantacion.periodo).filter(Boolean));
  return [...unicas].sort((a, b) => b.localeCompare(a, 'es'));
}

/** Técnicos activos asignados a alguna plantación, en el orden de `perfiles`.
 *  Los admins no figuran: ven todas. */
export function tecnicosAsignados(
  perfiles: PerfilResumen[],
  plantaciones: PlantacionConStats[],
): PerfilResumen[] {
  const asignados = new Set(plantaciones.flatMap((plantacion) => plantacion.tecnicos));
  return perfiles.filter((perfil) => perfil.activo && asignados.has(perfil.id));
}

/** Falso si el técnico elegido ya no está entre los elegibles (desactivado o sin asignaciones). */
export function tecnicoElegible(visiblePor: string, elegibles: string[]): boolean {
  return visiblePor === TECNICO_TODOS || elegibles.includes(visiblePor);
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

function pasaVisiblePor(plantacion: PlantacionConStats, tecnico: string): boolean {
  return tecnico === TECNICO_TODOS || plantacion.tecnicos.includes(tecnico);
}

function pasaVisibles(plantacion: PlantacionConStats, visibles: FiltroVisibles): boolean {
  if (visibles === FILTRO_VISIBLES.todas) return true;
  return plantacion.visibleInApp === (visibles === FILTRO_VISIBLES.si);
}

function pasaFiltros(plantacion: PlantacionConStats, filtros: FiltrosPlantaciones): boolean {
  return (
    coincide(plantacion, filtros.busqueda) &&
    pasaEstado(plantacion, filtros.estado) &&
    pasaTemporada(plantacion, filtros.temporada) &&
    pasaVisiblePor(plantacion, filtros.visiblePor) &&
    pasaVisibles(plantacion, filtros.visibles)
  );
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
  filtros: FiltrosPlantaciones,
): PlantacionConStats[] {
  return plantaciones
    .filter((plantacion) => pasaFiltros(plantacion, filtros))
    .sort(comparar(filtros.orden));
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
