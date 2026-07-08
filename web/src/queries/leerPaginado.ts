/*
 * Lectura completa de una consulta de Supabase paginando con `.range()`.
 *
 * PostgREST (Supabase) topea la respuesta en `max-rows` (1000 por defecto), así
 * que un `.limit(15000)` igual devuelve sólo 1000 filas. Para datasets grandes
 * (~7600 árboles por plantación) hay que pedir página por página hasta agotar.
 */

/** Tamaño de página: el `max-rows` por defecto de Supabase/PostgREST. */
export const TAMANO_PAGINA = 1000;

type RespuestaPagina<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/**
 * Acumula todas las filas pidiendo páginas de `TAMANO_PAGINA` con `.range()`
 * hasta que una página devuelve menos filas que el tamaño (no hay más).
 * Ante error, lanza un Error preservando el `code` de Postgres (para que el
 * caller pueda distinguir, p.ej., UNDEFINED_COLUMN de la migración 023).
 */
export async function leerPaginado<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<RespuestaPagina<T>>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 0; ; pagina++) {
    const desde = pagina * TAMANO_PAGINA;
    const { data, error } = await consultar(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < TAMANO_PAGINA) break;
  }
  return filas;
}
