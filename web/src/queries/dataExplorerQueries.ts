import { idDeArbol } from '../../../shared/codigoPlantacion';
import { supabase } from '../lib/supabase';
import {
  COLUMNA_CODIGO_PLANTACION,
  resolverBusquedaArbol,
  type BusquedaArbol,
} from './busquedaArbol';
import { contarOLanzar } from './conteo';
import { citarValorOr } from './escaparBusqueda';
import { ESPECIE_SIN_IDENTIFICAR } from './especiesConstantes';
import { ESQUEMAS_FOTO_LOCAL } from './fotoConstantes';
import type { EstadoPlantacion } from './plantationQueries';

const RPC_ARBOLES_POR_GRUPO = 'arboles_por_grupo';

export type TipoGrupo = 'linea' | 'bosquete';
export type EstadoGrupo = EstadoPlantacion;

/** Valor especial del filtro de especie: árboles sin identificar (species_id null). */
export { ESPECIE_SIN_IDENTIFICAR } from './especiesConstantes';

export const ARBOLES_POR_PAGINA = 50;

export type ParcelaConStats = {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  createdAt: string;
  grupos: number;
  arboles: number;
};

export type GrupoConDetalle = {
  id: string;
  nombre: string;
  codigo: string;
  tipo: TipoGrupo;
  estado: EstadoGrupo;
  parcelaId: string | null;
  parcelaCodigo: string;
  createdAt: string;
  arboles: number;
};

export type ArbolDetalle = {
  id: string;
  subId: string;
  /** `<SubID>-<código de plantación>` (#559). */
  idArbol: string;
  posicion: number | null;
  /** null = N/N. */
  especieId: string | null;
  especieCodigo: string | null;
  especieNombre: string | null;
  especieNombreCientifico: string | null;
  grupoId: string;
  grupoCodigo: string;
  grupoNombre: string | null;
  parcelaId: string | null;
  fotoUrl: string | null;
  usuarioRegistro: string | null;
  createdAt: string;
  /** Las columnas GPS llegan con la migración 023: undefined si no existe o no se capturó. */
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  gpsCapturedAt?: string;
};

export type FiltrosGrupos = { parcelaId?: string };

export type FiltrosArboles = {
  parcelaId?: string;
  groupId?: string;
  /** Id de especie, o ESPECIE_SIN_IDENTIFICAR para árboles sin identificar. */
  speciesId?: string;
  /** true = solo con GPS, false = solo sin GPS, undefined = todos. */
  conGps?: boolean;
  /** true = solo con foto subida, false = solo sin ella, undefined = todos. */
  conFoto?: boolean;
  busqueda?: string;
};

export type PaginaArboles = {
  arboles: ArbolDetalle[];
  total: number;
  totalPaginas: number;
};

export type FilaParcela = {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  created_at: string;
};

export type FilaGrupo = {
  id: string;
  nombre: string;
  codigo: string;
  tipo: TipoGrupo;
  estado: EstadoGrupo;
  parcela_id: string | null;
  created_at: string;
  parcelas: { codigo: string } | null;
};

export type FilaArbol = {
  id: string;
  sub_id: string;
  posicion: number | null;
  group_id: string;
  foto_url: string | null;
  usuario_registro: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  gps_captured_at?: string | null;
  species_id: string | null;
  species: { codigo: string; nombre: string; nombre_cientifico: string | null } | null;
  groups: {
    codigo: string;
    nombre: string;
    parcela_id: string | null;
    plantations: { codigo: string } | null;
  } | null;
};

type ArbolesDeGrupo = { group_id: string; parcela_id: string | null; arboles: number };

/** Cada grupo de la plantación con su parcela y su cantidad de árboles, incluidos los vacíos (#684). */
async function listarArbolesPorGrupo(plantationId: string): Promise<ArbolesDeGrupo[]> {
  const { data, error } = await supabase.rpc(RPC_ARBOLES_POR_GRUPO, {
    p_plantation_id: plantationId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArbolesDeGrupo[];
}

function statsDeParcela(fila: FilaParcela, grupos: ArbolesDeGrupo[]): ParcelaConStats {
  const deLaParcela = grupos.filter((grupo) => grupo.parcela_id === fila.id);
  return {
    id: fila.id,
    nombre: fila.nombre,
    codigo: fila.codigo,
    descripcion: fila.descripcion,
    createdAt: fila.created_at,
    grupos: deLaParcela.length,
    arboles: deLaParcela.reduce((total, grupo) => total + grupo.arboles, 0),
  };
}

/** Parcelas activas con sus conteos de grupos y árboles, contados en el server. */
export async function listarParcelasConStats(plantationId: string): Promise<ParcelaConStats[]> {
  const [{ data, error }, grupos] = await Promise.all([
    supabase
      .from('parcelas')
      .select('id, nombre, codigo, descripcion, created_at')
      .eq('plantation_id', plantationId)
      .is('deleted_at', null)
      .order('codigo', { ascending: true }),
    listarArbolesPorGrupo(plantationId),
  ]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaParcela[]).map((fila) => statsDeParcela(fila, grupos));
}

function mapearGrupo(fila: FilaGrupo, arboles: number): GrupoConDetalle {
  return {
    id: fila.id,
    nombre: fila.nombre,
    codigo: fila.codigo,
    tipo: fila.tipo,
    estado: fila.estado,
    parcelaId: fila.parcela_id,
    parcelaCodigo: fila.parcelas?.codigo ?? '',
    createdAt: fila.created_at,
    arboles,
  };
}

/** Grupos de la plantación con su parcela embebida y count de árboles. */
export async function listarGrupos(
  plantationId: string,
  filtros: FiltrosGrupos = {},
): Promise<GrupoConDetalle[]> {
  let consulta = supabase
    .from('groups')
    .select('id, nombre, codigo, tipo, estado, parcela_id, created_at, parcelas(codigo)')
    .eq('plantation_id', plantationId);
  if (filtros.parcelaId) consulta = consulta.eq('parcela_id', filtros.parcelaId);
  const [{ data, error }, grupos] = await Promise.all([
    consulta.order('codigo', { ascending: true }),
    listarArbolesPorGrupo(plantationId),
  ]);
  if (error) throw new Error(error.message);
  const conteos = new Map(grupos.map((grupo) => [grupo.group_id, grupo.arboles]));
  // Embed many-to-one: llega como objeto, no array (cliente sin typegen).
  const filas = (data ?? []) as unknown as FilaGrupo[];
  return filas.map((fila) => mapearGrupo(fila, conteos.get(fila.id) ?? 0));
}

/**
 * Qué trae una consulta de árboles. Los filtros miran `groups.parcela_id` y
 * `groups.plantations.codigo`: las columnas tienen que embeber
 * `groups!inner(parcela_id, plantation_id, plantations!inner(codigo))`, o el
 * filtro acota el embed y no los árboles.
 */
export type SelectArboles = {
  columnas: string;
  opciones?: { count?: 'exact'; head?: boolean };
};

const SELECT_LISTADO: SelectArboles = {
  columnas:
    '*, species(codigo, nombre, nombre_cientifico), groups!inner(codigo, nombre, parcela_id, plantation_id, plantations!inner(codigo))',
  opciones: { count: 'exact' },
};

/** Lo mínimo para contar con todos los filtros, sin traer filas. */
const SELECT_CONTEO: SelectArboles = {
  columnas: 'id, groups!inner(parcela_id, plantation_id, plantations!inner(codigo))',
  opciones: { count: 'exact', head: true },
};

/** Árboles de la plantación, con el scope vía join interno. */
function consultaBaseArboles(plantationId: string, { columnas, opciones }: SelectArboles) {
  return supabase.from('trees').select(columnas, opciones).eq('groups.plantation_id', plantationId);
}

export type ConsultaArboles = ReturnType<typeof consultaBaseArboles>;

/** Patrón LIKE de un esquema local, ej. `file://%`. */
function patronEsquemaLocal(esquema: string): string {
  return `${esquema}%`;
}

/**
 * "Con foto" = foto subida al bucket, igual que `tieneFotoSubida`: no basta con
 * que `foto_url` no sea nulo, porque una foto que el celular todavía no
 * sincronizó guarda un `file://` que no se puede mostrar.
 */
function aplicarFiltroFoto(consulta: ConsultaArboles, conFoto: boolean): ConsultaArboles {
  if (conFoto) {
    consulta = consulta.not('foto_url', 'is', null);
    for (const esquema of ESQUEMAS_FOTO_LOCAL) {
      consulta = consulta.not('foto_url', 'like', patronEsquemaLocal(esquema));
    }
    return consulta;
  }
  const condiciones = [
    'foto_url.is.null',
    ...ESQUEMAS_FOTO_LOCAL.map(
      (esquema) => `foto_url.like.${citarValorOr(patronEsquemaLocal(esquema))}`,
    ),
  ];
  return consulta.or(condiciones.join(','));
}

function aplicarFiltrosArboles(
  consulta: ConsultaArboles,
  filtros: FiltrosArboles,
  busqueda?: BusquedaArbol,
): ConsultaArboles {
  if (filtros.parcelaId) consulta = consulta.eq('groups.parcela_id', filtros.parcelaId);
  if (filtros.groupId) consulta = consulta.eq('group_id', filtros.groupId);
  if (filtros.speciesId === ESPECIE_SIN_IDENTIFICAR) consulta = consulta.is('species_id', null);
  else if (filtros.speciesId) consulta = consulta.eq('species_id', filtros.speciesId);
  if (filtros.conGps === true) consulta = consulta.not('latitude', 'is', null);
  if (filtros.conGps === false) consulta = consulta.is('latitude', null);
  if (filtros.conFoto !== undefined) consulta = aplicarFiltroFoto(consulta, filtros.conFoto);
  if (busqueda) consulta = consulta.ilike('sub_id', busqueda.patronSubId);
  if (busqueda?.codigo) consulta = consulta.eq(COLUMNA_CODIGO_PLANTACION, busqueda.codigo);
  return consulta;
}

/** La búsqueda por ID del filtro, resuelta: un ID Árbol completo consulta los códigos de plantación. */
export function resolverBusquedaDeFiltros(
  filtros: FiltrosArboles,
): Promise<BusquedaArbol | undefined> {
  return filtros.busqueda ? resolverBusquedaArbol(filtros.busqueda) : Promise.resolve(undefined);
}

/**
 * Árboles de la plantación con los filtros del listado. Recibe la búsqueda ya
 * resuelta para que una lectura paginada arme una consulta por página sin
 * resolverla de nuevo.
 */
export function consultaArbolesFiltrados(
  plantationId: string,
  filtros: FiltrosArboles,
  busqueda: BusquedaArbol | undefined,
  select: SelectArboles = SELECT_LISTADO,
): ConsultaArboles {
  return aplicarFiltrosArboles(consultaBaseArboles(plantationId, select), filtros, busqueda);
}

/** Más nuevos primero. El id desempata: paginar con `range` no repite ni saltea filas. */
export function ordenarComoListado(consulta: ConsultaArboles): ConsultaArboles {
  return consulta.order('created_at', { ascending: false }).order('id', { ascending: false });
}

/** Coordenadas GPS de la fila: undefined si la migración 023 no está o no hay dato. */
function camposGps(fila: FilaArbol) {
  return {
    latitude: fila.latitude ?? undefined,
    longitude: fila.longitude ?? undefined,
    gpsAccuracy: fila.gps_accuracy ?? undefined,
    gpsCapturedAt: fila.gps_captured_at ?? undefined,
  };
}

function mapearArbol(fila: FilaArbol): ArbolDetalle {
  return {
    id: fila.id,
    subId: fila.sub_id,
    idArbol: idDeArbol(fila.sub_id, fila.groups?.plantations?.codigo),
    posicion: fila.posicion,
    especieId: fila.species_id,
    especieCodigo: fila.species?.codigo ?? null,
    especieNombre: fila.species?.nombre ?? null,
    especieNombreCientifico: fila.species?.nombre_cientifico ?? null,
    grupoId: fila.group_id,
    grupoCodigo: fila.groups?.codigo ?? '',
    grupoNombre: fila.groups?.nombre ?? null,
    parcelaId: fila.groups?.parcela_id ?? null,
    fotoUrl: fila.foto_url,
    usuarioRegistro: fila.usuario_registro,
    createdAt: fila.created_at,
    ...camposGps(fila),
  };
}

/** Árboles de la plantación paginados server-side (50 por página, más nuevos primero). */
export async function listarArboles(
  plantationId: string,
  filtros: FiltrosArboles = {},
  pagina = 1,
): Promise<PaginaArboles> {
  const desde = (pagina - 1) * ARBOLES_POR_PAGINA;
  const busqueda = await resolverBusquedaDeFiltros(filtros);
  const { data, error, count } = await ordenarComoListado(
    consultaArbolesFiltrados(plantationId, filtros, busqueda),
  ).range(desde, desde + ARBOLES_POR_PAGINA - 1);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    arboles: ((data ?? []) as unknown as FilaArbol[]).map(mapearArbol),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / ARBOLES_POR_PAGINA)),
  };
}

/** Cuántos árboles deja el filtro y cuántos de ellos tienen la foto subida. */
export type ConteoDelFiltro = { total: number; conFoto: number };

type Contar = (filtros: FiltrosArboles) => Promise<number>;

/** Si el filtro ya fija la foto, el segundo conteo sale sin consultar. */
function contarConFoto(filtros: FiltrosArboles, total: Promise<number>, contar: Contar) {
  if (filtros.conFoto === undefined) return contar({ ...filtros, conFoto: true });
  return filtros.conFoto ? total : Promise.resolve(0);
}

/** Conteos del filtro del listado, con `count` sin traer filas. */
export async function contarArbolesDelFiltro(
  plantationId: string,
  filtros: FiltrosArboles,
): Promise<ConteoDelFiltro> {
  const busqueda = await resolverBusquedaDeFiltros(filtros);
  const contar: Contar = async (conFiltros) => {
    const consulta = consultaArbolesFiltrados(plantationId, conFiltros, busqueda, SELECT_CONTEO);
    const { count, error } = await consulta;
    return contarOLanzar(count, error);
  };
  const total = contar(filtros);
  const [totalLeido, conFoto] = await Promise.all([total, contarConFoto(filtros, total, contar)]);
  return { total: totalLeido, conFoto };
}
