/*
 * Puntos GPS de los árboles para el mapa satelital del dashboard. A diferencia de los
 * conteos del dashboard, acá cada árbol es un punto: se leen las filas, paginadas.
 */
import { idDeArbol } from '../../../shared/codigoPlantacion';
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { supabase } from '../lib/supabase';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';
import { leerPaginado } from './leerPaginado';

export type PuntoGps = {
  lat: number;
  lng: number;
  codigo: string;
  nombre: string;
  /** `<SubID>-<código de plantación>` (#704). */
  idArbol: string;
  subId: string;
  /** Parcela del grupo del árbol; null si el grupo no tiene parcela. */
  parcelaId: string | null;
};

type FilaPuntoGps = {
  latitude: number;
  longitude: number;
  sub_id: string;
  species_id: string | null;
  species: { codigo: string; nombre: string } | null;
  groups: { parcela_id: string | null; plantations: { codigo: string } | null } | null;
};

function mapearPunto(fila: FilaPuntoGps): PuntoGps {
  return {
    lat: fila.latitude,
    lng: fila.longitude,
    codigo: fila.species?.codigo ?? ESPECIE_SIN_IDENTIFICAR,
    nombre: fila.species?.nombre ?? NOMBRE_SIN_IDENTIFICAR,
    idArbol: idDeArbol(fila.sub_id, fila.groups?.plantations?.codigo),
    subId: fila.sub_id,
    parcelaId: fila.groups?.parcela_id ?? null,
  };
}

const COLUMNAS_PUNTO = 'latitude, longitude, sub_id, species_id, species(codigo, nombre)';
const EMBED_GRUPO = 'groups!inner(plantation_id, parcela_id, plantations(codigo))';

function consultarPuntos(plantationId: string, desde: number, hasta: number) {
  return supabase
    .from('trees')
    .select(`${COLUMNAS_PUNTO}, ${EMBED_GRUPO}`)
    .eq('groups.plantation_id', plantationId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('id')
    .range(desde, hasta);
}

/** Lectura paginada (sin tope de 1000); si `latitude`/`longitude` (migración 023) no existen, devuelve [] en vez de romper. */
export async function listarPuntosGps(plantationId: string): Promise<PuntoGps[]> {
  try {
    const filas = await leerPaginado<FilaPuntoGps>(
      (desde, hasta) =>
        // Embed many-to-one: llega como objeto, no array (cliente sin typegen).
        consultarPuntos(plantationId, desde, hasta) as unknown as PromiseLike<{
          data: FilaPuntoGps[] | null;
          error: { message: string; code?: string } | null;
        }>,
    );
    return filas.map(mapearPunto);
  } catch (error) {
    if ((error as { code?: string }).code === PG_ERROR.UNDEFINED_COLUMN) return [];
    throw error;
  }
}
