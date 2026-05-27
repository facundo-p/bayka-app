/**
 * Tests for useParcelas hook — mock-based, validates that the hook is a thin
 * orchestrator over parcelaQueries.listByPlantacionWithStats via useLiveData.
 *
 * We do NOT render React here — instead we mock useLiveData to capture the
 * fetcher passed to it, then assert behavior by invoking the fetcher and
 * inspecting the return shape under different states.
 */

const mockUseLiveData = jest.fn();
const mockListByPlantacionWithStats = jest.fn();

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: (fetcher: () => Promise<unknown>, deps: unknown[]) =>
    mockUseLiveData(fetcher, deps),
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/queries/parcelaQueries', () => ({
  listByPlantacionWithStats: (id: string) => mockListByPlantacionWithStats(id),
}));

import { useParcelas } from '../../src/hooks/useParcelas';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useParcelas', () => {
  test('plantacionId undefined → no llama a useLiveData con la query real, retorna parcelas=[]', () => {
    mockUseLiveData.mockReturnValue({ data: undefined });
    const result = useParcelas(undefined);
    expect(result).toEqual({ parcelas: [], isLoading: false, error: null });
    // useLiveData is still invoked (hook rules), but with a no-op fetcher
    // that resolves to []. We assert by invoking the fetcher manually.
    const fetcher = mockUseLiveData.mock.calls[0][0];
    return expect(fetcher()).resolves.toEqual([]);
  });

  test('plantacionId valido invoca listByPlantacionWithStats con ese id', async () => {
    mockUseLiveData.mockReturnValue({ data: undefined });
    mockListByPlantacionWithStats.mockResolvedValue([]);
    useParcelas('plant-1');
    const fetcher = mockUseLiveData.mock.calls[0][0];
    await fetcher();
    expect(mockListByPlantacionWithStats).toHaveBeenCalledWith('plant-1');
  });

  test('cuando data aun no llego, isLoading=true y parcelas=[]', () => {
    mockUseLiveData.mockReturnValue({ data: undefined });
    const result = useParcelas('plant-1');
    expect(result.isLoading).toBe(true);
    expect(result.parcelas).toEqual([]);
  });

  test('cuando data llega, isLoading=false y parcelas=data', () => {
    const sample = [{
      id: 'p-1', plantacionId: 'plant-1', nombre: 'Lote A', codigo: 'LA',
      descripcion: null, pendingSync: false, createdAt: '2026-01-01', updatedAt: '2026-01-01',
      deletedAt: null, gruposCount: 2, treesCount: 7, pendingSyncBelow: false,
    }];
    mockUseLiveData.mockReturnValue({ data: sample });
    const result = useParcelas('plant-1');
    expect(result.isLoading).toBe(false);
    expect(result.parcelas).toEqual(sample);
  });

  test('error siempre es null en esta version del hook', () => {
    mockUseLiveData.mockReturnValue({ data: [] });
    const result = useParcelas('plant-1');
    expect(result.error).toBeNull();
  });

  test('deps incluyen plantacionId (re-render con id distinto dispara re-fetch)', () => {
    mockUseLiveData.mockReturnValue({ data: undefined });
    useParcelas('plant-1');
    const deps1 = mockUseLiveData.mock.calls[0][1];
    expect(deps1).toEqual(['plant-1']);
    useParcelas('plant-2');
    const deps2 = mockUseLiveData.mock.calls[1][1];
    expect(deps2).toEqual(['plant-2']);
  });

  test('parcela tombstoneada NO aparece (delegado al query layer — verificamos passthrough)', () => {
    // The hook does not filter; it trusts listByPlantacionWithStats to omit
    // tombstones. We assert that whatever the query returns is returned
    // verbatim — and the query test (parcela-queries.test.ts) already
    // verifies the filter.
    const active = {
      id: 'p-active', plantacionId: 'plant-1', nombre: 'A', codigo: 'A',
      descripcion: null, pendingSync: false, createdAt: '2026-01-01', updatedAt: '2026-01-01',
      deletedAt: null, gruposCount: 0, treesCount: 0, pendingSyncBelow: false,
    };
    mockUseLiveData.mockReturnValue({ data: [active] });
    const result = useParcelas('plant-1');
    expect(result.parcelas).toEqual([active]);
    expect(result.parcelas.every((p) => p.deletedAt === null)).toBe(true);
  });
});
