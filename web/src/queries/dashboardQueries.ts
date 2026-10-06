/*
 * Datos del dashboard de una plantación. El server agrupa los árboles por parcela,
 * especie, mes, GPS y foto (RPC `dashboard_arboles`, #684); acá se suman esos grupos
 * con funciones puras, así el filtro por parcela no vuelve a pedir nada.
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

/** Cantidad de árboles por especie, orden descendente; N/N van como "Sin identificar". */
export function agruparPorEspecie(
  arboles: ConteoArboles[],
  especies: EspecieCatalogo[],
): DistribucionEspecie[] {
  const porId = new Map(especies.map((especie) => [especie.id, especie]));
  const conteos = sumarPor(arboles, (conteo) => conteo.speciesId);
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

/**
 * Agregados del alcance elegido: toda la plantación (`parcelaId` null) o una parcela.
 * `totalGrupos` y `totalParcelas` describen el tamaño de la plantación, no el del
 * recorte, así que no se filtran.
 */
export function calcularDashboard(
  fuente: FuenteDashboard,
  parcelaId: string | null,
): DashboardData {
  const arboles = filtrarPorParcela(fuente.arboles, parcelaId);
  return {
    ...calcularKpis(arboles),
    totalGrupos: fuente.totalGrupos,
    totalParcelas: fuente.parcelas.length,
    porEspecie: agruparPorEspecie(arboles, fuente.especies),
    porParcela: agruparPorParcela(arboles, fuente.parcelas),
    porMes: agruparPorMes(arboles),
  };
}
