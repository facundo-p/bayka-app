import { supabase } from '../lib/supabase';
import { contarOLanzar } from './conteo';
import { ESPECIE_SIN_IDENTIFICAR } from './especiesConstantes';
import { leerPaginado } from './leerPaginado';

export type TipoGrupo = 'linea' | 'bosquete';
export type EstadoGrupo = 'activa' | 'finalizada';

/** Valor especial del filtro de especie: árboles sin identificar (species_id null). */
export { ESPECIE_SIN_IDENTIFICAR } from './especiesConstantes';

/** Tamaño de página del listado de árboles. */
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
  posicion: number | null;
  especieCodigo: string | null;
  especieNombre: string | null;
  grupoId: string;
  grupoCodigo: string;
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
  /** Búsqueda parcial por sub_id. */
  busqueda?: string;
};

export type PaginaArboles = {
  arboles: ArbolDetalle[];
  total: number;
  totalPaginas: number;
};

type FilaParcela = {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  created_at: string;
};

type FilaGrupo = {
  id: string;
  nombre: string;
  codigo: string;
  tipo: TipoGrupo;
  estado: EstadoGrupo;
  parcela_id: string | null;
  created_at: string;
  parcelas: { codigo: string } | null;
};

type FilaArbol = {
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
  species: { codigo: string; nombre: string } | null;
  groups: { codigo: string; parcela_id: string | null } | null;
};

async function contarGruposDeParcela(parcelaId: string): Promise<number> {
  const { count, error } = await supabase
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('parcela_id', parcelaId);
  return contarOLanzar(count, error);
}

/** Árboles de la parcela: trees → groups (join interno por parcela_id). */
async function contarArbolesDeParcela(parcelaId: string): Promise<number> {
  const { count, error } = await supabase
    .from('trees')
    .select('id, groups!inner(parcela_id)', { count: 'exact', head: true })
    .eq('groups.parcela_id', parcelaId);
  return contarOLanzar(count, error);
}

async function parcelaConStats(fila: FilaParcela): Promise<ParcelaConStats> {
  const [grupos, arboles] = await Promise.all([
    contarGruposDeParcela(fila.id),
    contarArbolesDeParcela(fila.id),
  ]);
  return {
    id: fila.id,
    nombre: fila.nombre,
    codigo: fila.codigo,
    descripcion: fila.descripcion,
    createdAt: fila.created_at,
    grupos,
    arboles,
  };
}

/**
 * Parcelas activas (excluye soft-deleted) con counts de grupos y árboles.
 * Dos counts head por parcela en paralelo: una plantación tiene pocas
 * parcelas, así que el costo es marginal.
 */
export async function listarParcelasConStats(plantationId: string): Promise<ParcelaConStats[]> {
  const { data, error } = await supabase
    .from('parcelas')
    .select('id, nombre, codigo, descripcion, created_at')
    .eq('plantation_id', plantationId)
    .is('deleted_at', null)
    .order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return Promise.all(((data ?? []) as FilaParcela[]).map(parcelaConStats));
}

/**
 * Cuenta árboles por grupo: trae los group_id de todos los árboles de la
 * plantación y agrega en cliente con un Map. Con hasta ~250 grupos, un count
 * head por grupo serían ~250 viajes (N+1); una lectura paginada con `.range()`
 * trae todo el dataset sin el tope de 1000 de PostgREST.
 */
async function contarArbolesPorGrupo(plantationId: string): Promise<Map<string, number>> {
  const filas = await leerPaginado<{ group_id: string }>((desde, hasta) =>
    supabase
      .from('trees')
      .select('group_id, groups!inner(plantation_id)')
      .eq('groups.plantation_id', plantationId)
      .range(desde, hasta),
  );
  const conteos = new Map<string, number>();
  for (const fila of filas) {
    conteos.set(fila.group_id, (conteos.get(fila.group_id) ?? 0) + 1);
  }
  return conteos;
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
  const [{ data, error }, conteos] = await Promise.all([
    consulta.order('codigo', { ascending: true }),
    contarArbolesPorGrupo(plantationId),
  ]);
  if (error) throw new Error(error.message);
  // El cliente sin typegen tipa el embed como array, pero la FK parcela_id →
  // parcelas es many-to-one: en runtime llega un objeto.
  const filas = (data ?? []) as unknown as FilaGrupo[];
  return filas.map((fila) => mapearGrupo(fila, conteos.get(fila.id) ?? 0));
}

/** Base del listado de árboles: embeds + scope por plantación vía join interno. */
function consultaBaseArboles(plantationId: string) {
  return supabase
    .from('trees')
    .select('*, species(codigo, nombre), groups!inner(codigo, parcela_id, plantation_id)', {
      count: 'exact',
    })
    .eq('groups.plantation_id', plantationId);
}

type ConsultaArboles = ReturnType<typeof consultaBaseArboles>;

function aplicarFiltrosArboles(
  consulta: ConsultaArboles,
  filtros: FiltrosArboles,
): ConsultaArboles {
  if (filtros.parcelaId) consulta = consulta.eq('groups.parcela_id', filtros.parcelaId);
  if (filtros.groupId) consulta = consulta.eq('group_id', filtros.groupId);
  if (filtros.speciesId === ESPECIE_SIN_IDENTIFICAR) consulta = consulta.is('species_id', null);
  else if (filtros.speciesId) consulta = consulta.eq('species_id', filtros.speciesId);
  if (filtros.conGps === true) consulta = consulta.not('latitude', 'is', null);
  if (filtros.conGps === false) consulta = consulta.is('latitude', null);
  if (filtros.busqueda) consulta = consulta.ilike('sub_id', `%${filtros.busqueda}%`);
  return consulta;
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
    posicion: fila.posicion,
    especieCodigo: fila.species?.codigo ?? null,
    especieNombre: fila.species?.nombre ?? null,
    grupoId: fila.group_id,
    grupoCodigo: fila.groups?.codigo ?? '',
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
  const { data, error, count } = await aplicarFiltrosArboles(
    consultaBaseArboles(plantationId),
    filtros,
  )
    .order('created_at', { ascending: false })
    .range(desde, desde + ARBOLES_POR_PAGINA - 1);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    arboles: ((data ?? []) as unknown as FilaArbol[]).map(mapearArbol),
    total,
    totalPaginas: Math.max(1, Math.ceil(total / ARBOLES_POR_PAGINA)),
  };
}
