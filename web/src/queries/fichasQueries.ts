/*
 * Lo que necesitan los PDF de árboles, la ficha (#754) y el reporte (#849): más
 * datos por árbol que el listado (científico, clasificación, nombres de parcela
 * y grupo).
 */
import { idDeArbol } from '../../../shared/codigoPlantacion';
import type { SubtipoEspecie, TipoEspecie } from '../../../shared/tiposEspecie';
import { supabase } from '../lib/supabase';
import {
  consultaArbolesFiltrados,
  ordenarComoListado,
  resolverBusquedaDeFiltros,
  type FiltrosArboles,
} from './dataExplorerQueries';
import { conSenal, leerPaginado, type RespuestaPagina } from './leerPaginado';

export type CodigoNombre = { codigo: string; nombre: string };

export type EspecieDeFicha = CodigoNombre & {
  nombreCientifico: string | null;
  tipo: TipoEspecie;
  subtipo: SubtipoEspecie;
};

export type GpsDeFicha = { lat: number; lng: number; precision: number | null };

export type ArbolParaFicha = {
  id: string;
  subId: string;
  /** `<SubID>-<código de plantación>` (#559). */
  idArbol: string;
  posicion: number | null;
  /** null = N/N. */
  especie: EspecieDeFicha | null;
  grupo: CodigoNombre;
  /** null si el grupo no tiene parcela o la parcela se eliminó. */
  parcela: CodigoNombre | null;
  parcelaId: string | null;
  fotoUrl: string | null;
  usuarioRegistro: string | null;
  createdAt: string;
  gps: GpsDeFicha | null;
};

type FilaParcela = CodigoNombre & { deleted_at: string | null };

type FilaArbolFicha = {
  id: string;
  sub_id: string;
  posicion: number | null;
  foto_url: string | null;
  usuario_registro: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  species: {
    codigo: string;
    nombre: string;
    nombre_cientifico: string | null;
    tipo: TipoEspecie;
    subtipo: SubtipoEspecie;
  } | null;
  groups: CodigoNombre & {
    parcela_id: string | null;
    plantations: { codigo: string } | null;
    parcelas: FilaParcela | null;
  };
};

/**
 * `parcelas.deleted_at` no puede filtrar con `!inner`: dejaría afuera a los
 * grupos sin parcela. `plantations` sí va con `!inner`: la búsqueda por ID
 * Árbol completo filtra por su código.
 */
const SELECT_FICHA =
  'id, sub_id, posicion, foto_url, usuario_registro, created_at, ' +
  'latitude, longitude, gps_accuracy, ' +
  'species(codigo, nombre, nombre_cientifico, tipo, subtipo), ' +
  'groups!inner(codigo, nombre, parcela_id, plantation_id, plantations!inner(codigo), ' +
  'parcelas(codigo, nombre, deleted_at))';

function parcelaVigente(parcela: FilaParcela | null): CodigoNombre | null {
  if (!parcela || parcela.deleted_at !== null) return null;
  return { codigo: parcela.codigo, nombre: parcela.nombre };
}

function gpsDe(fila: FilaArbolFicha): GpsDeFicha | null {
  if (fila.latitude == null || fila.longitude == null) return null;
  return { lat: fila.latitude, lng: fila.longitude, precision: fila.gps_accuracy };
}

function especieDe(fila: FilaArbolFicha): EspecieDeFicha | null {
  const { species } = fila;
  if (!species) return null;
  const { codigo, nombre, tipo, subtipo } = species;
  return { codigo, nombre, nombreCientifico: species.nombre_cientifico, tipo, subtipo };
}

function mapearArbolFicha(fila: FilaArbolFicha): ArbolParaFicha {
  const { groups } = fila;
  return {
    id: fila.id,
    subId: fila.sub_id,
    idArbol: idDeArbol(fila.sub_id, groups.plantations?.codigo),
    posicion: fila.posicion,
    especie: especieDe(fila),
    grupo: { codigo: groups.codigo, nombre: groups.nombre },
    parcela: parcelaVigente(groups.parcelas),
    parcelaId: groups.parcela_id,
    fotoUrl: fila.foto_url,
    usuarioRegistro: fila.usuario_registro,
    createdAt: fila.created_at,
    gps: gpsDe(fila),
  };
}

/** El árbol de la plantación con ese id; null si no existe o no es de la plantación. */
export async function leerArbolParaFicha(
  plantationId: string,
  arbolId: string,
): Promise<ArbolParaFicha | null> {
  const { data, error } = await supabase
    .from('trees')
    .select(SELECT_FICHA)
    .eq('groups.plantation_id', plantationId)
    .eq('id', arbolId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Embeds many-to-one: llegan como objeto, no array (cliente sin typegen).
  const fila = data as unknown as FilaArbolFicha | null;
  return fila && mapearArbolFicha(fila);
}

/**
 * Todos los árboles que deja el filtro del listado, en su orden, de a 1.000 por
 * pedido. Con `senal` abortada corta la página en vuelo y no pide más.
 */
export async function listarArbolesDelFiltro(
  plantationId: string,
  filtros: FiltrosArboles,
  senal?: AbortSignal,
): Promise<ArbolParaFicha[]> {
  senal?.throwIfAborted();
  const busqueda = await resolverBusquedaDeFiltros(filtros);
  const select = { columnas: SELECT_FICHA };
  const pagina = (desde: number, hasta: number) => {
    const consulta = consultaArbolesFiltrados(plantationId, filtros, busqueda, select);
    // Embeds many-to-one: llegan como objeto, no array (cliente sin typegen).
    return conSenal(
      ordenarComoListado(consulta).range(desde, hasta),
      senal,
    ) as unknown as PromiseLike<RespuestaPagina<FilaArbolFicha>>;
  };
  const filas = await leerPaginado(pagina, senal);
  return filas.map(mapearArbolFicha);
}

/** Nombre de la organización dueña de la plantación; null si no se puede leer. */
export async function leerNombreOrganizacion(plantationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('plantations')
    .select('organizations(nombre)')
    .eq('id', plantationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const fila = data as unknown as { organizations: { nombre: string } | null } | null;
  return fila?.organizations?.nombre ?? null;
}
