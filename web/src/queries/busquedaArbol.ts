import { separarIdArbol } from '../lib/codigoPlantacion';
import { supabase } from '../lib/supabase';
import { escaparComodinesLike, patronContiene } from './escaparBusqueda';

/** Código de la plantación visto desde `trees` (requiere `groups!inner(plantations!inner(codigo))`). */
export const COLUMNA_CODIGO_PLANTACION = 'groups.plantations.codigo';

async function listarCodigosPlantacion(): Promise<string[]> {
  const { data, error } = await supabase.from('plantations').select('codigo');
  if (error) return [];
  return ((data ?? []) as Array<{ codigo: string }>).map((fila) => fila.codigo);
}

export type BusquedaArbol = {
  /** Patrón `ilike` sobre `sub_id`: exacto si vino un ID Árbol completo, "contiene" si no. */
  patronSubId: string;
  /** Código de plantación al que acotar; solo con un ID Árbol completo. */
  codigo?: string;
};

/** Qué filtrar para el texto buscado; el ID Árbol completo (#559) se parte en SubID y código. */
export async function resolverBusquedaArbol(texto: string): Promise<BusquedaArbol> {
  const separado = texto.includes('-')
    ? separarIdArbol(texto, await listarCodigosPlantacion())
    : null;
  if (!separado) return { patronSubId: patronContiene(texto) };
  return { patronSubId: escaparComodinesLike(separado.subId), codigo: separado.codigo };
}
