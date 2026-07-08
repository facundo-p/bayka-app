/*
 * Puntos GPS de los árboles de una plantación para el mapa satelital del
 * dashboard. Lectura liviana (lat/lng/especie) de los árboles con coordenadas,
 * agregada en cliente. Espeja los patrones de dashboardQueries: embed
 * `groups!inner` para acotar por plantación y tolerancia a la migración 023.
 */
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { supabase } from '../lib/supabase';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from './especiesConstantes';

/** Tope de filas de la lectura de puntos (holgado sobre los ~7600 reales). */
const LIMITE_PUNTOS_MAPA = 20000;

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

function consultarPuntos(plantationId: string) {
  return supabase
    .from('trees')
    .select(`${COLUMNAS_PUNTO}, ${EMBED_GRUPO}`)
    .eq('groups.plantation_id', plantationId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(LIMITE_PUNTOS_MAPA);
}

/** Árboles con GPS de la plantación, mapeados a puntos con color de especie.
 *  `latitude`/`longitude` son de la migración 023: si no están aplicadas el
 *  select falla con UNDEFINED_COLUMN y se devuelve [] (el mapa queda vacío en
 *  vez de romper, igual de tolerante que el dashboard). */
export async function listarPuntosGps(plantationId: string): Promise<PuntoGps[]> {
  const { data, error } = await consultarPuntos(plantationId);
  if (error?.code === PG_ERROR.UNDEFINED_COLUMN) return [];
  if (error) throw new Error(error.message);
  // El cliente sin typegen tipa el embed `species` como array, pero la FK
  // species_id → species es many-to-one: en runtime llega un objeto.
  return ((data ?? []) as unknown as FilaPuntoGps[]).map(mapearPunto);
}
