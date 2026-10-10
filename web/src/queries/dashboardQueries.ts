/*
 * Datos del dashboard de una plantación. El server agrupa los árboles por parcela,
 * especie, mes, GPS y foto (RPC `dashboard_arboles`, #684); acá se suman esos grupos
 * con funciones puras, así los filtros por parcela y especie no vuelven a pedir nada.
 */
import { porcentaje } from '../lib/formato';
import { supabase } from '../lib/supabase';
import { contarOLanzar } from './conteo';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';
import { listarCatalogo, type EspecieCatalogo } from './especieQueries';

const RPC_DASHBOARD_ARBOLES = 'dashboard_arboles';

export { NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';

/** Cantidad de árboles que comparten parcela, especie, mes de registro, GPS y foto. */
export type ConteoArboles = {
  parcelaId: string | null;
  speciesId: string | null;
  /** `YYYY-MM`, en UTC. */
  mes: string;
  conGps: boolean;
  /** Foto subida al bucket; una local de mobile sin sincronizar no cuenta. */
  conFoto: boolean;
  cantidad: number;
};

export type ParcelaDashboard = {
  id: string;
  nombre: string;
  codigo: string;
};

export type DistribucionEspecie = { codigo: string; nombre: string; cantidad: number };
export type DistribucionParcela = { id: string; nombre: string; codigo: string; cantidad: number };
export type RegistrosMes = { mes: string; cantidad: number };

export type KpisArboles = {
  totalArboles: number;
  arbolesNN: number;
  especiesUsadas: number;
  arbolesConGps: number;
  arbolesConFoto: number;
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

function sumarPor<Clave>(
  conteos: ConteoArboles[],
  claveDe: (conteo: ConteoArboles) => Clave,
): Map<Clave, number> {
  const sumas = new Map<Clave, number>();
  for (const conteo of conteos) {
    const clave = claveDe(conteo);
    sumas.set(clave, (sumas.get(clave) ?? 0) + conteo.cantidad);
  }
  return sumas;
}

function sumar(conteos: ConteoArboles[], incluir: (conteo: ConteoArboles) => boolean): number {
  return conteos.reduce((total, conteo) => total + (incluir(conteo) ? conteo.cantidad : 0), 0);
}

export function calcularKpis(arboles: ConteoArboles[]): KpisArboles {
  const total = sumar(arboles, () => true);
  const sinEspecie = sumar(arboles, (conteo) => conteo.speciesId === null);
  const conGps = sumar(arboles, (conteo) => conteo.conGps);
  const conFoto = sumar(arboles, (conteo) => conteo.conFoto);
  const especies = new Set(
    arboles.map((conteo) => conteo.speciesId).filter((speciesId) => speciesId !== null),
  ).size;
  return {
    totalArboles: total,
    arbolesNN: sinEspecie,
    especiesUsadas: especies,
    arbolesConGps: conGps,
    arbolesConFoto: conFoto,
    porcentajeConGps: porcentaje(conGps, total),
    porcentajeConFoto: porcentaje(conFoto, total),
  };
}

type EspecieVisible = Pick<DistribucionEspecie, 'codigo' | 'nombre'>;

const ESPECIE_NN: EspecieVisible = {
  codigo: ESPECIE_SIN_IDENTIFICAR,
  nombre: NOMBRE_SIN_IDENTIFICAR,
};

function indexarEspecies(especies: EspecieCatalogo[]): Map<string, EspecieCatalogo> {
  return new Map(especies.map((especie) => [especie.id, especie]));
}

/** Sin especie o fuera del catálogo, el árbol se muestra como N/N. */
function especieVisible(
  speciesId: string | null,
  porId: Map<string, EspecieCatalogo>,
): EspecieVisible {
  const especie = speciesId !== null ? porId.get(speciesId) : undefined;
  return especie ? { codigo: especie.codigo, nombre: especie.nombre } : ESPECIE_NN;
}

/** Cantidad de árboles por especie, orden descendente; N/N van como "Sin identificar". */
export function agruparPorEspecie(
  arboles: ConteoArboles[],
  especies: EspecieCatalogo[],
): DistribucionEspecie[] {
  const porId = indexarEspecies(especies);
  const conteos = sumarPor(arboles, (conteo) => conteo.speciesId);
  const distribucion = [...conteos].map(([speciesId, cantidad]) => ({
    ...especieVisible(speciesId, porId),
    cantidad,
  }));
  return distribucion.sort((primera, segunda) => segunda.cantidad - primera.cantidad);
}

/** Árboles por parcela activa, en el orden recibido; sin árboles queda en 0 (barra en cero informa). */
export function agruparPorParcela(
  arboles: ConteoArboles[],
  parcelas: ParcelaDashboard[],
): DistribucionParcela[] {
  const conteos = sumarPor(arboles, (conteo) => conteo.parcelaId);
  return parcelas.map((parcela) => ({
    id: parcela.id,
    nombre: parcela.nombre,
    codigo: parcela.codigo,
    cantidad: conteos.get(parcela.id) ?? 0,
  }));
}

/** Árboles de una parcela; sin parcela, la lista entera. */
export function filtrarPorParcela(
  arboles: ConteoArboles[],
  parcelaId: string | null,
): ConteoArboles[] {
  return parcelaId === null ? arboles : arboles.filter((conteo) => conteo.parcelaId === parcelaId);
}

/** Árboles de una especie, por el código que se muestra (N/N junta a los sin especie). */
export function filtrarPorEspecie(
  arboles: ConteoArboles[],
  especieCodigo: string | null,
  especies: EspecieCatalogo[],
): ConteoArboles[] {
  if (especieCodigo === null) return arboles;
  const porId = indexarEspecies(especies);
  return arboles.filter(
    (conteo) => especieVisible(conteo.speciesId, porId).codigo === especieCodigo,
  );
}

/** La especie elegida conserva su fila aunque no tenga árboles en la parcela:
 *  sin ella no habría dónde clickear para soltarla. */
export function conEspecieElegida(
  distribucion: DistribucionEspecie[],
  especieCodigo: string | null,
  especies: EspecieCatalogo[],
): DistribucionEspecie[] {
  if (especieCodigo === null) return distribucion;
  if (distribucion.some((especie) => especie.codigo === especieCodigo)) return distribucion;
  const especie = especies.find((candidata) => candidata.codigo === especieCodigo);
  const nombre = especie?.nombre ?? NOMBRE_SIN_IDENTIFICAR;
  return [...distribucion, { codigo: especieCodigo, nombre, cantidad: 0 }];
}

export function agruparPorMes(arboles: ConteoArboles[]): RegistrosMes[] {
  const conteos = sumarPor(arboles, (conteo) => conteo.mes);
  return [...conteos]
    .map(([mes, cantidad]) => ({ mes, cantidad }))
    .sort((primero, segundo) => primero.mes.localeCompare(segundo.mes));
}

type FilaConteoArboles = {
  parcela_id: string | null;
  species_id: string | null;
  mes: string;
  con_gps: boolean;
  con_foto: boolean;
  cantidad: number;
};

async function listarConteosArboles(plantationId: string): Promise<ConteoArboles[]> {
  const { data, error } = await supabase.rpc(RPC_DASHBOARD_ARBOLES, {
    p_plantation_id: plantationId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaConteoArboles[]).map((fila) => ({
    parcelaId: fila.parcela_id,
    speciesId: fila.species_id,
    mes: fila.mes,
    conGps: fila.con_gps,
    conFoto: fila.con_foto,
    cantidad: fila.cantidad,
  }));
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

/** Lecturas crudas: los agregados salen después, según la parcela elegida. */
export type FuenteDashboard = {
  arboles: ConteoArboles[];
  especies: EspecieCatalogo[];
  parcelas: ParcelaDashboard[];
  totalGrupos: number;
};

export async function obtenerFuenteDashboard(plantationId: string): Promise<FuenteDashboard> {
  const [arboles, especies, parcelas, totalGrupos] = await Promise.all([
    listarConteosArboles(plantationId),
    listarCatalogo(),
    listarParcelasDashboard(plantationId),
    contarGrupos(plantationId),
  ]);
  return { arboles, especies, parcelas, totalGrupos };
}

/** Filtros combinables del dashboard; null es "sin filtro". */
export type FiltrosDashboard = {
  parcelaId: string | null;
  especieCodigo: string | null;
};

export const SIN_FILTROS: FiltrosDashboard = { parcelaId: null, especieCodigo: null };

/** Lo que mide el panel «Por especie»: la parcela elegida, sin el filtro de especie. */
export type Composicion = Pick<KpisArboles, 'totalArboles' | 'especiesUsadas'>;

export type DashboardFiltrado = DashboardData & { composicion: Composicion };

function calcularComposicion(arboles: ConteoArboles[]): Composicion {
  const { totalArboles, especiesUsadas } = calcularKpis(arboles);
  return { totalArboles, especiesUsadas };
}

/**
 * Agregados del alcance elegido. KPIs y meses cruzan parcela y especie; «Por especie»
 * mira solo la parcela y «Por parcela» solo la especie, porque son los selectores
 * del otro filtro. `totalGrupos` y `totalParcelas` describen el tamaño de la
 * plantación, no el del recorte, así que no se filtran.
 */
export function calcularDashboard(
  fuente: FuenteDashboard,
  filtros: FiltrosDashboard = SIN_FILTROS,
): DashboardFiltrado {
  const { parcelaId, especieCodigo } = filtros;
  const deParcela = filtrarPorParcela(fuente.arboles, parcelaId);
  const deEspecie = filtrarPorEspecie(fuente.arboles, especieCodigo, fuente.especies);
  const arboles = filtrarPorEspecie(deParcela, especieCodigo, fuente.especies);
  const porEspecie = agruparPorEspecie(deParcela, fuente.especies);
  return {
    ...calcularKpis(arboles),
    totalGrupos: fuente.totalGrupos,
    totalParcelas: fuente.parcelas.length,
    composicion: calcularComposicion(deParcela),
    porEspecie: conEspecieElegida(porEspecie, especieCodigo, fuente.especies),
    porParcela: agruparPorParcela(deEspecie, fuente.parcelas),
    porMes: agruparPorMes(arboles),
  };
}
