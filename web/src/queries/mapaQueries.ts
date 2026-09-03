/*
 * Puntos GPS de los árboles para el mapa satelital del dashboard: lectura liviana agregada
 * en cliente, espejando dashboardQueries (embed `groups!inner`, tolerancia a la migración 023).
 */
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { supabase } from '../lib/supabase';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';
import { leerPaginado } from './leerPaginado';

export type PuntoGps = { lat: number; lng: number; codigo: string; nombre: string };

type FilaPuntoGps = {
  latitude: number;
  longitude: number;
  species_id: string | null;
  species: { codigo: string; nombre: string } | null;
};

function mapearPunto(fila: FilaPuntoGps): PuntoGps {
  return {
    lat: fila.latitude,
    lng: fila.longitude,
    codigo: fila.species?.codigo ?? ESPECIE_SIN_IDENTIFICAR,
    nombre: fila.species?.nombre ?? NOMBRE_SIN_IDENTIFICAR,
  };
}

const COLUMNAS_PUNTO = 'latitude, longitude, species_id, species(codigo, nombre)';
const EMBED_GRUPO = 'groups!inner(plantation_id)';

function consultarPuntos(plantationId: string, desde: number, hasta: number) {
  return supabase
    .from('trees')
    .select(`${COLUMNAS_PUNTO}, ${EMBED_GRUPO}`)
    .eq('groups.plantation_id', plantationId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .range(desde, hasta);
}

/** Lectura paginada (sin tope de 1000); si `latitude`/`longitude` (migración 023) no existen, devuelve [] en vez de romper. */
export async function listarPuntosGps(plantationId: string): Promise<PuntoGps[]> {
  try {
    const filas = await leerPaginado<FilaPuntoGps>((desde, hasta) =>
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
