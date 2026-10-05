/*
 * Lectura completa de una consulta de Supabase paginando con `.range()`.
 *
 * PostgREST (Supabase) topea la respuesta en `max-rows` (1000 por defecto), así
 * que un `.limit(15000)` igual devuelve sólo 1000 filas. Para datasets grandes
 * (~7600 árboles por plantación) hay que pedir página por página hasta agotar.
 */
import { errorDeSupabase } from '../lib/clasificarError';

/** Tamaño de página: el `max-rows` por defecto de Supabase/PostgREST. */
export const TAMANO_PAGINA = 1000;

/**
 * Páginas pedidas a la vez después de la primera (#684). Una plantación de ~7600
 * árboles baja en tres tandas en vez de ocho viajes en serie; a lo sumo se piden
 * tres páginas vacías de más.
 */
export const PAGINAS_EN_PARALELO = 4;

type RespuestaPagina<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/**
 * Acumula todas las filas pidiendo páginas de `TAMANO_PAGINA` con `.range()`
 * hasta que una página devuelve menos filas que el tamaño (no hay más). La
 * primera va sola; si viene llena, el resto se pide de a `PAGINAS_EN_PARALELO`
 * y se arma en orden.
 * Ante error, lanza un Error preservando el `code` de Postgres (para que el
 * caller pueda distinguir, p.ej., UNDEFINED_COLUMN de la migración 023).
 * `consultar` tiene que ordenar por una clave única: sin ORDER BY, el OFFSET
 * puede repetir o saltear filas entre páginas (#682).
 */
export async function leerPaginado<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<RespuestaPagina<T>>,
): Promise<T[]> {
  const pedir = (pagina: number) => leerPagina(consultar, pagina);
  const primera = await pedir(0);
  const filas = [...primera];
  if (primera.length < TAMANO_PAGINA) return filas;
  for (let desde = 1; ; desde += PAGINAS_EN_PARALELO) {
    const paginas = Array.from({ length: PAGINAS_EN_PARALELO }, (_, i) => pedir(desde + i));
    for (const lote of await Promise.all(paginas)) {
      filas.push(...lote);
      if (lote.length < TAMANO_PAGINA) return filas;
    }
  }
}

async function leerPagina<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<RespuestaPagina<T>>,
  pagina: number,
): Promise<T[]> {
  const desde = pagina * TAMANO_PAGINA;
  const { data, error } = await consultar(desde, desde + TAMANO_PAGINA - 1);
  if (error) throw errorDeSupabase(error);
  return data ?? [];
}
