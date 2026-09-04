/**
 * Corre `cb(tx)` en una transacción DB si el driver la soporta; si no (mocks sin `db.transaction`,
 * o better-sqlite3 sync tirando "cannot return a promise" en tests de integración), cae a
 * `cb(db)` sin transacción. Prod (expo-sqlite) siempre soporta transacciones async.
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
