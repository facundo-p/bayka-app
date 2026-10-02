import { CODIGO_PLANTACION, separarIdArbol } from '../lib/codigoPlantacion';
import { supabase } from '../lib/supabase';
import { escaparComodinesLike, patronContiene } from './escaparBusqueda';

/** Código de la plantación visto desde `trees` (requiere `groups!inner(plantations!inner(codigo))`). */
export const COLUMNA_CODIGO_PLANTACION = 'groups.plantations.codigo';

/** Los códigos casi no cambian: se reusan entre teclas y páginas. */
const VIGENCIA_CODIGOS_MS = 5 * 60_000;

let cacheCodigos: { codigos: string[]; vence: number } | null = null;

export function reiniciarCacheCodigosPlantacion(): void {
  cacheCodigos = null;
}

/** Códigos de las plantaciones visibles; ante un error devuelve [] sin cachear. */
export async function listarCodigosPlantacion(): Promise<string[]> {
  if (cacheCodigos && cacheCodigos.vence > Date.now()) return cacheCodigos.codigos;
  const { data, error } = await supabase.from('plantations').select('codigo');
  if (error) return [];
  const codigos = ((data ?? []) as Array<{ codigo: string }>).map((fila) => fila.codigo);
  cacheCodigos = { codigos, vence: Date.now() + VIGENCIA_CODIGOS_MS };
  return codigos;
}

export type BusquedaArbol = {
  /** Patrón `ilike` sobre `sub_id`: exacto si vino un ID Árbol completo, "contiene" si no. */
  patronSubId: string;
  /** Código de plantación al que acotar; solo con un ID Árbol completo. */
  codigo?: string;
};

/** Qué filtrar para el texto buscado; el ID Árbol completo (#559) se parte en SubID y código. */
export async function resolverBusquedaArbol(texto: string): Promise<BusquedaArbol> {
  const separado = texto.includes(CODIGO_PLANTACION.separadorIdArbol)
    ? separarIdArbol(texto, await listarCodigosPlantacion())
    : null;
  if (!separado) return { patronSubId: patronContiene(texto) };
  return { patronSubId: escaparComodinesLike(separado.subId), codigo: separado.codigo };
}
