/**
 * Paginates a Supabase query through .range() to bypass the PostgREST 1000-row
 * default limit. `buildQuery` must return a fresh query builder on each call;
 * the helper appends .range(from, to) per page and concatenates results.
 */
export async function fetchAllRows<T>(
  buildQuery: () => any
): Promise<{ data: T[] | null; error: any }> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  // Safety cap: 1M rows. If exceeded, something is wrong upstream.
  while (from < 1_000_000) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: all, error: null };
}
