/*
 * Puntos GPS de los árboles de una plantación para el mapa satelital del
 * dashboard. Lectura liviana (lat/lng/especie) de los árboles con coordenadas,
 * agregada en cliente. Espeja los patrones de dashboardQueries: embed
 * `groups!inner` para acotar por plantación y tolerancia a la migración 023.
 */
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { supabase } from '../lib/supabase';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';
import { leerPaginado } from './leerPaginado';

/** Punto GPS de un árbol; `codigo`/`nombre` son su especie (N/N si no tiene). */
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

/** Árboles con GPS de la plantación (lectura paginada, sin el tope de 1000),
 *  mapeados a puntos con color de especie. `latitude`/`longitude` son de la
 *  migración 023: si no están aplicadas el select falla con UNDEFINED_COLUMN y
 *  se devuelve [] (el mapa queda vacío en vez de romper). */
export async function listarPuntosGps(plantationId: string): Promise<PuntoGps[]> {
  try {
    const filas = await leerPaginado<FilaPuntoGps>((desde, hasta) =>
      // El embed `species` es many-to-one: en runtime llega un objeto.
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
