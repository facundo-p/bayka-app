import { fetchAllRows } from '../../src/services/sync/paginate';
import { cancelarCorrida, iniciarCorrida, SyncCanceladoError, terminarCorrida } from '../../src/services/sync/cancelacion';
import { esTimeout, MARCA_DE_TIMEOUT } from '../../src/supabase/fetchConTimeout';

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

describe('fetchAllRows — timeouts y cancelación (#451)', () => {
  afterEach(() => terminarCorrida());

  // Devolverlo como `{ error }` hace que la fase lo loguee y siga: el pull termina
  // incompleto y se reporta como exitoso.
  test('un timeout corta el pull en vez de devolverse como una tabla vacía', async () => {
    const range = jest.fn().mockResolvedValue({
      data: null,
      error: { message: `${MARCA_DE_TIMEOUT}: sin respuesta en 30000ms — /rest/v1/trees` },
    });

    const fallo = await fetchAllRows(jest.fn().mockReturnValue({ range })).catch((e) => e);

    expect(esTimeout(fallo)).toBe(true);
  });

  test('un error que no es timeout sigue devolviéndose como { error }', async () => {
    const error = { code: 'PGRST301', message: 'JWT expired' };
    const range = jest.fn().mockResolvedValue({ data: null, error });

    await expect(fetchAllRows(jest.fn().mockReturnValue({ range }))).resolves.toEqual({ data: null, error });
  });

  test('cancelado antes de arrancar, no pide ni una página', async () => {
    iniciarCorrida();
    cancelarCorrida();
    const range = jest.fn();

    await expect(fetchAllRows(jest.fn().mockReturnValue({ range }))).rejects.toThrow(SyncCanceladoError);
    expect(range).not.toHaveBeenCalled();
  });

  test('cancelar entre páginas corta el barrido', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    iniciarCorrida();
    const range = jest.fn().mockImplementation(async () => {
      cancelarCorrida();
      return { data: fullPage, error: null };
    });

    await expect(fetchAllRows(jest.fn().mockReturnValue({ range }))).rejects.toThrow(SyncCanceladoError);
    expect(range).toHaveBeenCalledTimes(1);
  });

  // postgrest entrega el abort dentro de `{ error }`, no como throw: sin esto la
  // cancelación se le reporta al usuario como un error del servidor.
  test('el abort que postgrest devuelve como { error } se reporta como cancelación', async () => {
    iniciarCorrida();
    cancelarCorrida();
    const range = jest.fn().mockResolvedValue({ data: null, error: { message: 'AbortError' } });
    // La query ya está construida cuando llega la cancelación: se saltea el chequeo
    // de entrada para llegar al de la respuesta.
    const buildQuery = jest.fn().mockReturnValue({ range });

    await expect(fetchAllRows(buildQuery)).rejects.toThrow(SyncCanceladoError);
  });

  test('le pasa el signal al builder para matar la página en vuelo', async () => {
    iniciarCorrida();
    const range = jest.fn().mockResolvedValue({ data: [], error: null });
    const query: any = { range, abortSignal: jest.fn(() => query) };

    await fetchAllRows(jest.fn().mockReturnValue(query));

    expect(query.abortSignal).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
  });

  test('un builder sin .abortSignal (mocks viejos) sigue funcionando', async () => {
    iniciarCorrida();
    const range = jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });

    await expect(fetchAllRows(jest.fn().mockReturnValue({ range }))).resolves.toEqual({ data: [{ id: 1 }], error: null });
  });
});
