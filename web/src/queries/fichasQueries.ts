/*
 * Lo que necesitan las fichas PDF de árboles (#754): más datos por árbol que el listado
 * (científico, clasificación, nombres de parcela y grupo, ID Global), leídos por ids.
 */
import { idDeArbol } from '../../../shared/codigoPlantacion';
import type { SubtipoEspecie, TipoEspecie } from '../../../shared/tiposEspecie';
import { supabase } from '../lib/supabase';

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
  /** null mientras no se generaron los IDs. */
  idGlobal: number | null;
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
  global_id: number | null;
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

/** `parcelas.deleted_at` no puede filtrar con `!inner`: dejaría afuera a los grupos sin parcela. */
const SELECT_FICHA =
  'id, sub_id, global_id, posicion, foto_url, usuario_registro, created_at, ' +
  'latitude, longitude, gps_accuracy, ' +
  'species(codigo, nombre, nombre_cientifico, tipo, subtipo), ' +
  'groups!inner(codigo, nombre, parcela_id, plantation_id, plantations(codigo), ' +
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
    idGlobal: fila.global_id,
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

/** Árboles de la plantación con esos ids, en el orden de `ids`; los que no existen se omiten. */
export async function listarArbolesParaFichas(
  plantationId: string,
  ids: readonly string[],
): Promise<ArbolParaFicha[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('trees')
    .select(SELECT_FICHA)
    .eq('groups.plantation_id', plantationId)
    .in('id', [...ids]);
  if (error) throw new Error(error.message);
  // Embeds many-to-one: llegan como objeto, no array (cliente sin typegen).
  const porId = new Map(
    ((data ?? []) as unknown as FilaArbolFicha[]).map((fila) => [fila.id, fila]),
  );
  return ids.flatMap((id) => {
    const fila = porId.get(id);
    return fila ? [mapearArbolFicha(fila)] : [];
  });
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
