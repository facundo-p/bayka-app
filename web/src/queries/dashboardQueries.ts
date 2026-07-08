/*
 * Datos del dashboard de una plantación.
 *
 * Decisión: se trae UNA sola lectura liviana de árboles (columnas mínimas) y
 * toda la agregación se hace en cliente. El dataset real es ~7600 árboles por
 * plantación, así que evita crear RPCs en Supabase y mantiene la lógica
 * testeable como funciones puras. Si el volumen crece más allá del tope,
 * migrar a una RPC con `group by` en el servidor.
 */
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { supabase } from '../lib/supabase';
import { tieneFotoSubida } from '../services/fotoService';
import { contarOLanzar } from './conteo';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';
import { listarCatalogo, type EspecieCatalogo } from './especieQueries';
import { leerPaginado } from './leerPaginado';

/** Largo del prefijo 'YYYY-MM' de una fecha ISO. */
const LARGO_MES_ISO = 7;

/** Nombre visible del segmento de árboles sin especie. */
export { NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';

/** Proyección mínima de un árbol para agregar en cliente. */
export type ArbolDashboard = {
  speciesId: string | null;
  fotoUrl: string | null;
  createdAt: string;
  latitude: number | null;
  groupId: string;
  parcelaId: string | null;
};

/** Parcela activa con lo justo para etiquetar el gráfico. */
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

/** Cuenta elementos por la clave que devuelve `claveDe`. */
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

/** Cantidad de árboles por especie, orden descendente; los N/N van como
 *  "Sin identificar" con código `ESPECIE_SIN_IDENTIFICAR`. */
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

/** Cantidad de árboles por parcela activa, en el orden recibido (por código).
 *  Una parcela sin árboles queda con cantidad 0 (la barra en cero informa). */
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

/** Registros por mes 'YYYY-MM', orden cronológico ascendente. */
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

/** Lectura paginada de todos los árboles (sin el tope de 1000 de PostgREST):
 *  columnas livianas + embed mínimo del grupo. `latitude` es de la migración
 *  023: si no está aplicada el select falla con UNDEFINED_COLUMN y se reintenta
 *  sin ella (el KPI de GPS queda en 0 en vez de romper el dashboard). */
async function listarArbolesDashboard(plantationId: string): Promise<ArbolDashboard[]> {
  // El cliente sin typegen tipa el embed como array, pero la FK group_id →
  // groups es many-to-one: en runtime llega un objeto.
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

/** Parcelas activas (excluye soft-deleted) ordenadas por código. */
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

/** Carga y agrega todos los datos del dashboard de la plantación. */
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
