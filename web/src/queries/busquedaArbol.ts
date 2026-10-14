import { CODIGO_PLANTACION, separarIdArbol } from '../../../shared/codigoPlantacion';
import { supabase } from '../lib/supabase';
import { escaparComodinesLike, patronContiene } from './escaparBusqueda';

/** Código de la plantación visto desde `trees` (requiere `groups!inner(plantations!inner(codigo))`). */
export const COLUMNA_CODIGO_PLANTACION = 'groups.plantations.codigo';

/** Los códigos casi no cambian: se reusan entre teclas y páginas. */
export const VIGENCIA_CODIGOS_MS = 5 * 60_000;

let cacheCodigos: { codigos: Promise<string[]>; vence: number } | null = null;

export function reiniciarCacheCodigosPlantacion(): void {
  cacheCodigos = null;
}

async function pedirCodigosPlantacion(): Promise<string[]> {
  const { data, error } = await supabase.from('plantations').select('codigo');
  if (error || !data) throw new Error(error?.message ?? 'Sin datos');
  return (data as Array<{ codigo: string }>).map((fila) => fila.codigo);
}

/**
 * Códigos de las plantaciones visibles. Cachea la promesa (las llamadas simultáneas
 * comparten un request); un fallo no se cachea y devuelve [].
 */
export async function listarCodigosPlantacion(): Promise<string[]> {
  if (!cacheCodigos || cacheCodigos.vence <= Date.now()) {
    const codigos = pedirCodigosPlantacion();
    const entrada = { codigos, vence: Date.now() + VIGENCIA_CODIGOS_MS };
    cacheCodigos = entrada;
    codigos.catch(() => {
      if (cacheCodigos === entrada) cacheCodigos = null;
    });
  }
  try {
    return await cacheCodigos.codigos;
  } catch {
    return [];
  }
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
