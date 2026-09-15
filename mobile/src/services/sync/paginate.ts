/**
 * Pagina una query de Supabase con .range() para saltar el límite default de 1000 filas de
 * PostgREST; `buildQuery` debe devolver un builder fresco por llamada. Fallback: si no expone
 * .range() (mocks de test), se usa como página única.
 */
export async function fetchAllRows<T>(
  buildQuery: () => any
): Promise<{ data: T[] | null; error: any }> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  // Safety cap: 1M rows. If exceeded, something is wrong upstream.
  while (from < 1_000_000) {
    const query = buildQuery();
    const pageResult = typeof query?.range === 'function'
      ? await query.range(from, from + PAGE_SIZE - 1)
      : await query;
    const { data, error } = pageResult;
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: all, error: null };
}
