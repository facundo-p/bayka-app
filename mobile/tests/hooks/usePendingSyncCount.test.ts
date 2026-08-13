/**
 * Tests de usePendingSyncCount — mock-based (mismo patrón que useParcelas.test):
 * se mockea useLiveData para no renderizar React y se valida la aritmética de
 * los contadores. Issue #71: pendingCount debe incluir fotos pendientes.
 *
 * Orden de llamadas a useLiveData dentro del hook (fijo):
 *   1. grupos pendientes  2. bloqueados N/N  3. fotos  4. parcelas
 */

const mockUseLiveData = jest.fn();

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: (fetcher: () => Promise<unknown>, deps: unknown[]) =>
    mockUseLiveData(fetcher, deps),
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/hooks/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user-1',
}));

const mockCountPendingGroups = jest.fn();
const mockCountNNBlockedGroups = jest.fn();
const mockCountPendingTreePhotos = jest.fn();
const mockCountPendingParcelas = jest.fn();

jest.mock('../../src/queries/pendingSyncQueries', () => ({
  countPendingGroups: (opts: unknown) => mockCountPendingGroups(opts),
  countNNBlockedGroups: (opts: unknown) => mockCountNNBlockedGroups(opts),
  countPendingTreePhotos: (opts: unknown) => mockCountPendingTreePhotos(opts),
  countPendingParcelas: (opts: unknown) => mockCountPendingParcelas(opts),
}));

import { usePendingSyncCount } from '../../src/hooks/usePendingSyncCount';

function mockLiveDataSequence(counts: { grupos: number; nn: number; fotos: number; parcelas: number }) {
  mockUseLiveData
    .mockReturnValueOnce({ data: [{ cnt: counts.grupos }] })
    .mockReturnValueOnce({ data: [{ cnt: counts.nn }] })
    .mockReturnValueOnce({ data: [{ cnt: counts.fotos }] })
    .mockReturnValueOnce({ data: [{ cnt: counts.parcelas }] });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePendingSyncCount', () => {
  test('pendingCount suma grupos + parcelas + fotos (issue #71)', () => {
    mockLiveDataSequence({ grupos: 2, nn: 0, fotos: 5, parcelas: 1 });

    const result = usePendingSyncCount();

    expect(result.pendingCount).toBe(8);
    expect(result.pendingGroupsCount).toBe(2);
    expect(result.pendingParcelasCount).toBe(1);
    expect(result.pendingPhotosCount).toBe(5);
  });

  test('solo fotos pendientes también enciende el contador', () => {
    mockLiveDataSequence({ grupos: 0, nn: 0, fotos: 3, parcelas: 0 });

    const result = usePendingSyncCount();

    expect(result.pendingCount).toBe(3);
  });

  test('syncableCount excluye fotos y parcelas (solo grupos menos N/N)', () => {
    mockLiveDataSequence({ grupos: 4, nn: 1, fotos: 9, parcelas: 2 });

    const result = usePendingSyncCount();

    expect(result.syncableCount).toBe(3);
    expect(result.blockedByNN).toBe(1);
  });

  test('sin data todavía, todos los contadores en 0', () => {
    mockUseLiveData.mockReturnValue({ data: undefined });

    const result = usePendingSyncCount();

    expect(result.pendingCount).toBe(0);
    expect(result.syncableCount).toBe(0);
  });

  test('los fetchers invocan las queries con plantacionId y userId', async () => {
    mockUseLiveData.mockReturnValue({ data: undefined });

    usePendingSyncCount('plant-1');

    const fetchers = mockUseLiveData.mock.calls.map((c) => c[0]);
    await Promise.all(fetchers.map((f) => f()));

    expect(mockCountPendingGroups).toHaveBeenCalledWith({ plantacionId: 'plant-1', userId: 'user-1' });
    expect(mockCountNNBlockedGroups).toHaveBeenCalledWith({ plantacionId: 'plant-1', userId: 'user-1' });
    expect(mockCountPendingTreePhotos).toHaveBeenCalledWith({ plantacionId: 'plant-1' });
    expect(mockCountPendingParcelas).toHaveBeenCalledWith({ plantacionId: 'plant-1' });
  });
});
