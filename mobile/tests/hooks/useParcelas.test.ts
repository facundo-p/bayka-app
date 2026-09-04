/**
 * Tests for useParcelas — mock-based: mocks useLiveData to capture the
 * fetcher it's given, then invokes it directly to assert the hook is a thin
 * orchestrator over parcelaQueries.listByPlantacionWithStats.
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
    // Still invokes useLiveData (hook rules) with a no-op fetcher; asserted by calling it directly.
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
    // Hook trusts listByPlantacionWithStats to filter tombstones (verified in parcela-queries.test.ts); this only checks passthrough.
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
