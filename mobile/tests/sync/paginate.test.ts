import { runInTransaction, fetchAllRows } from '../../src/services/sync/paginate';

describe('runInTransaction', () => {
  test('runs cb(database) directly when database.transaction is not a function', async () => {
    const database = {};
    const cb = jest.fn().mockResolvedValue('direct-result');
    const result = await runInTransaction(database, cb);
    expect(result).toBe('direct-result');
    expect(cb).toHaveBeenCalledWith(database);
  });

  test('runs cb via database.transaction when supported', async () => {
    const transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn('tx-handle'));
    const database = { transaction };
    const cb = jest.fn().mockResolvedValue('tx-result');
    const result = await runInTransaction(database, cb);
    expect(result).toBe('tx-result');
    expect(transaction).toHaveBeenCalledWith(cb);
    expect(cb).toHaveBeenCalledWith('tx-handle');
  });

  test('falls back to cb(database) when the driver rejects async transaction callbacks', async () => {
    const database = {
      transaction: jest.fn().mockRejectedValue(new Error('Transaction function cannot return a promise')),
    };
    const cb = jest.fn().mockResolvedValue('fallback-result');
    const result = await runInTransaction(database, cb);
    expect(result).toBe('fallback-result');
    expect(cb).toHaveBeenCalledWith(database);
  });

  test('rethrows any other error from database.transaction', async () => {
    const database = {
      transaction: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const cb = jest.fn();
    await expect(runInTransaction(database, cb)).rejects.toThrow('boom');
  });
});

describe('fetchAllRows', () => {
  test('returns a single page when it is smaller than PAGE_SIZE', async () => {
    const page = [{ id: 1 }, { id: 2 }];
    const range = jest.fn().mockResolvedValue({ data: page, error: null });
    const buildQuery = jest.fn().mockReturnValue({ range });

    const result = await fetchAllRows(buildQuery);

    expect(result).toEqual({ data: page, error: null });
    expect(range).toHaveBeenCalledWith(0, 999);
  });

  test('pages through .range() until a short page is returned', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const lastPage = [{ id: 1000 }, { id: 1001 }];
    const range = jest.fn()
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: lastPage, error: null });
    const buildQuery = jest.fn().mockReturnValue({ range });

    const result = await fetchAllRows(buildQuery);

    expect(result.data).toHaveLength(1002);
    expect(result.error).toBeNull();
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  test('stops and returns the error on a failed page', async () => {
    const error = { message: 'network down' };
    const range = jest.fn().mockResolvedValue({ data: null, error });
    const buildQuery = jest.fn().mockReturnValue({ range });

    const result = await fetchAllRows(buildQuery);

    expect(result).toEqual({ data: null, error });
  });

  test('stops when a page comes back empty', async () => {
    const range = jest.fn().mockResolvedValue({ data: [], error: null });
    const buildQuery = jest.fn().mockReturnValue({ range });

    const result = await fetchAllRows(buildQuery);

    expect(result).toEqual({ data: [], error: null });
    expect(range).toHaveBeenCalledTimes(1);
  });

  test('awaits the query directly as a single page when it has no .range()', async () => {
    const page = [{ id: 1 }];
    const buildQuery = jest.fn().mockReturnValue(Promise.resolve({ data: page, error: null }));

    const result = await fetchAllRows(buildQuery);

    expect(result).toEqual({ data: page, error: null });
  });
});
