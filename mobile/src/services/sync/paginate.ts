/**
 * Runs `cb(tx)` inside a database transaction when supported. Falls back to
 * `cb(db)` (no transaction) in two cases:
 *   1. `db.transaction` is undefined (unit-test mocks with partial db objects).
 *   2. The driver throws "Transaction function cannot return a promise"
 *      (better-sqlite3 sync API in integration tests — it doesn't allow async
 *      callbacks even though drizzle/expo-sqlite in prod does).
 * Prod expo-sqlite always supports async transactions, so this preserves
 * the transactional speedup at runtime.
 */
export async function runInTransaction<T>(
  database: any,
  cb: (tx: any) => Promise<T>,
): Promise<T> {
  if (typeof database?.transaction !== 'function') {
    return cb(database);
  }
  try {
    return await database.transaction(cb);
  } catch (e: any) {
    if (typeof e?.message === 'string' && e.message.includes('cannot return a promise')) {
      return cb(database);
    }
    throw e;
  }
}

/**
 * Paginates a Supabase query through .range() to bypass the PostgREST 1000-row
 * default limit. `buildQuery` must return a fresh query builder on each call;
 * the helper appends .range(from, to) per page and concatenates results.
 *
 * Fallback: if buildQuery() returns something without .range() (test mocks
 * that resolve directly to {data, error}), the helper awaits the result as a
 * single page. Real PostgREST builders always expose .range().
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
