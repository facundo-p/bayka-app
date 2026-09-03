/*
 * Datos del dashboard de una plantación: una sola lectura liviana de árboles (columnas
 * mínimas) agregada en cliente (~7600 árboles/plantación); evita RPCs y mantiene la lógica
 * testeable como funciones puras. Migrar a RPC con `group by` si el volumen crece.
 */
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { supabase } from '../lib/supabase';
import { tieneFotoSubida } from '../services/fotoService';
import { contarOLanzar } from './conteo';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';
import { listarCatalogo, type EspecieCatalogo } from './especieQueries';
import { leerPaginado } from './leerPaginado';

const LARGO_MES_ISO = 7;

export { NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';

export type ArbolDashboard = {
  speciesId: string | null;
  fotoUrl: string | null;
  createdAt: string;
  latitude: number | null;
  groupId: string;
  parcelaId: string | null;
};

export type ParcelaDashboard = {
  id: string;
  nombre: string;
  codigo: string;
};

export type DistribucionEspecie = { codigo: string; nombre: string; cantidad: number };
export type DistribucionParcela = { nombre: string; codigo: string; cantidad: number };
export type RegistrosMes = { mes: string; cantidad: number };

export type KpisArboles = {
  totalArboles: number;
  arbolesNN: number;
  especiesUsadas: number;
  porcentajeConGps: number;
  porcentajeConFoto: number;
};

export type DashboardData = KpisArboles & {
  totalGrupos: number;
  totalParcelas: number;
  porEspecie: DistribucionEspecie[];
  porParcela: DistribucionParcela[];
  porMes: RegistrosMes[];
};

/** Porcentaje entero redondeado; 0 si el total es 0. */
export function porcentaje(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

function contarPor<Elemento, Clave>(
  elementos: Elemento[],
  claveDe: (elemento: Elemento) => Clave,
): Map<Clave, number> {
  const conteos = new Map<Clave, number>();
  for (const elemento of elementos) {
    const clave = claveDe(elemento);
    conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
  }
  return conteos;
}

/** KPIs derivados de la lista de árboles (foto local de mobile no cuenta). */
export function calcularKpis(arboles: ArbolDashboard[]): KpisArboles {
  const total = arboles.length;
  const sinEspecie = arboles.filter((arbol) => arbol.speciesId === null).length;
  const conGps = arboles.filter((arbol) => arbol.latitude !== null).length;
  const conFoto = arboles.filter((arbol) => tieneFotoSubida(arbol.fotoUrl)).length;
  const especies = new Set(
    arboles.map((arbol) => arbol.speciesId).filter((speciesId) => speciesId !== null),
  ).size;
  return {
    totalArboles: total,
    arbolesNN: sinEspecie,
    especiesUsadas: especies,
    porcentajeConGps: porcentaje(conGps, total),
    porcentajeConFoto: porcentaje(conFoto, total),
  };
}

/** Cantidad de árboles por especie, orden descendente; N/N van como "Sin identificar". */
export function agruparPorEspecie(
  arboles: ArbolDashboard[],
  especies: EspecieCatalogo[],
): DistribucionEspecie[] {
  const porId = new Map(especies.map((especie) => [especie.id, especie]));
  const conteos = contarPor(arboles, (arbol) => arbol.speciesId);
  const distribucion = [...conteos].map(([speciesId, cantidad]) => {
    const especie = speciesId !== null ? porId.get(speciesId) : undefined;
    return {
      codigo: especie?.codigo ?? ESPECIE_SIN_IDENTIFICAR,
      nombre: especie?.nombre ?? NOMBRE_SIN_IDENTIFICAR,
      cantidad,
    };
  });
  return distribucion.sort((primera, segunda) => segunda.cantidad - primera.cantidad);
}

/** Árboles por parcela activa, en el orden recibido; sin árboles queda en 0 (barra en cero informa). */
export function agruparPorParcela(
  arboles: ArbolDashboard[],
  parcelas: ParcelaDashboard[],
): DistribucionParcela[] {
  const conteos = contarPor(arboles, (arbol) => arbol.parcelaId);
  return parcelas.map((parcela) => ({
    nombre: parcela.nombre,
    codigo: parcela.codigo,
    cantidad: conteos.get(parcela.id) ?? 0,
  }));
}

export function agruparPorMes(arboles: ArbolDashboard[]): RegistrosMes[] {
  const conteos = contarPor(arboles, (arbol) => arbol.createdAt.slice(0, LARGO_MES_ISO));
  return [...conteos]
    .map(([mes, cantidad]) => ({ mes, cantidad }))
    .sort((primero, segundo) => primero.mes.localeCompare(segundo.mes));
}

type FilaArbolDashboard = {
  species_id: string | null;
  foto_url: string | null;
  created_at: string;
  /** Columna de la migración 023: puede no existir todavía. */
  latitude?: number | null;
  group_id: string;
  groups: { parcela_id: string | null } | null;
};

function mapearArbolDashboard(fila: FilaArbolDashboard): ArbolDashboard {
  return {
    speciesId: fila.species_id,
    fotoUrl: fila.foto_url,
    createdAt: fila.created_at,
    latitude: fila.latitude ?? null,
    groupId: fila.group_id,
    parcelaId: fila.groups?.parcela_id ?? null,
  };
}

const COLUMNAS_ARBOL_BASE = 'species_id, foto_url, created_at, group_id';
const EMBED_GRUPO = 'groups!inner(plantation_id, parcela_id)';

function consultarArbolesDashboard(plantationId: string, columnas: string, desde: number, hasta: number) {
  return supabase
    .from('trees')
    .select(`${columnas}, ${EMBED_GRUPO}`)
    .eq('groups.plantation_id', plantationId)
    .range(desde, hasta);
}

/**
 * Lectura paginada (sin el tope de 1000 de PostgREST). `latitude` es de la migración 023:
 * si falla con UNDEFINED_COLUMN se reintenta sin ella (el KPI de GPS queda en 0).
 */
async function listarArbolesDashboard(plantationId: string): Promise<ArbolDashboard[]> {
  // Embed many-to-one: llega como objeto, no array (cliente sin typegen).
  const aFilas = (filas: unknown[]) =>
    (filas as FilaArbolDashboard[]).map(mapearArbolDashboard);
  try {
    return aFilas(
      await leerPaginado((desde, hasta) =>
        consultarArbolesDashboard(plantationId, `${COLUMNAS_ARBOL_BASE}, latitude`, desde, hasta),
      ),
    );
  } catch (error) {
    if ((error as { code?: string }).code !== PG_ERROR.UNDEFINED_COLUMN) throw error;
    return aFilas(
      await leerPaginado((desde, hasta) =>
        consultarArbolesDashboard(plantationId, COLUMNAS_ARBOL_BASE, desde, hasta),
      ),
    );
  }
}

async function listarParcelasDashboard(plantationId: string): Promise<ParcelaDashboard[]> {
  const { data, error } = await supabase
    .from('parcelas')
    .select('id, nombre, codigo')
    .eq('plantation_id', plantationId)
    .is('deleted_at', null)
    .order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ParcelaDashboard[];
}

async function contarGrupos(plantationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('plantation_id', plantationId);
  return contarOLanzar(count, error);
}

export async function obtenerDashboard(plantationId: string): Promise<DashboardData> {
  const [arboles, especies, parcelas, totalGrupos] = await Promise.all([
    listarArbolesDashboard(plantationId),
    listarCatalogo(),
    listarParcelasDashboard(plantationId),
    contarGrupos(plantationId),
  ]);
  return {
    ...calcularKpis(arboles),
    totalGrupos,
    totalParcelas: parcelas.length,
    porEspecie: agruparPorEspecie(arboles, especies),
    porParcela: agruparPorParcela(arboles, parcelas),
    porMes: agruparPorMes(arboles),
  };
}
