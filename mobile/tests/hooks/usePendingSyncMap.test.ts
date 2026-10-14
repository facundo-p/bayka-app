/**
 * Tests de usePendingSyncMap (patrón useParcelas.test). Issue #71: el dot por
 * tarjeta debe sumar igual que el ícono global, para apagarse al sincronizar
 * esa plantación. Orden de useLiveData: grupos, parcelas, fotos.
 */

const mockUseLiveData = jest.fn();

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: (fetcher: () => Promise<unknown>, deps?: unknown[]) =>
    mockUseLiveData(fetcher, deps),
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/hooks/useQuienSube', () => ({
  useQuienSube: () => ({ userId: 'user-1', esAdmin: false }),
}));

const mockGroupsByPlantation = jest.fn();
const mockParcelasByPlantation = jest.fn();
const mockPhotosByPlantation = jest.fn();

jest.mock('../../src/queries/pendingSyncQueries', () => ({
  countPendingGroupsByPlantation: (quien: unknown) => mockGroupsByPlantation(quien),
  countPendingParcelasByPlantation: () => mockParcelasByPlantation(),
  countPendingTreePhotosByPlantation: (quien: unknown) => mockPhotosByPlantation(quien),
}));

// useMemo fuera de React: se ejecuta la factory directamente.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
}));

import { usePendingSyncMap } from '../../src/hooks/usePendingSyncMap';

type Row = { plantacionId: string; cnt: number };

function mockLiveDataSequence(grupos: Row[], parcelas: Row[], fotos: Row[]) {
  mockUseLiveData
    .mockReturnValueOnce({ data: grupos })
    .mockReturnValueOnce({ data: parcelas })
    .mockReturnValueOnce({ data: fotos });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePendingSyncMap', () => {
  test('suma grupos + parcelas + fotos por plantación', () => {
    mockLiveDataSequence(
      [{ plantacionId: 'p1', cnt: 2 }],
      [{ plantacionId: 'p1', cnt: 1 }, { plantacionId: 'p2', cnt: 1 }],
      [{ plantacionId: 'p1', cnt: 3 }],
    );

    const map = usePendingSyncMap();

    expect(map.get('p1')).toBe(6);
    expect(map.get('p2')).toBe(1);
  });

  test('una plantación con SOLO una parcela pendiente aparece en el mapa (bug original)', () => {
    mockLiveDataSequence([], [{ plantacionId: 'p9', cnt: 1 }], []);

    const map = usePendingSyncMap();

    expect(map.get('p9')).toBe(1);
    expect(map.size).toBe(1);
  });

  test('sin data todavía devuelve mapa vacío', () => {
    mockUseLiveData.mockReturnValue({ data: undefined });

    const map = usePendingSyncMap();

    expect(map.size).toBe(0);
  });

  test('los fetchers invocan las queries agrupadas (grupos y fotos con quién sube)', async () => {
    mockUseLiveData.mockReturnValue({ data: undefined });
    mockGroupsByPlantation.mockResolvedValue([]);
    mockParcelasByPlantation.mockResolvedValue([]);
    mockPhotosByPlantation.mockResolvedValue([]);

    usePendingSyncMap();

    const fetchers = mockUseLiveData.mock.calls.map((c) => c[0]);
    await Promise.all(fetchers.map((f) => f()));

    expect(mockGroupsByPlantation).toHaveBeenCalledWith({ userId: 'user-1', esAdmin: false });
    expect(mockParcelasByPlantation).toHaveBeenCalled();
    expect(mockPhotosByPlantation).toHaveBeenCalledWith({ userId: 'user-1', esAdmin: false });
  });
});
