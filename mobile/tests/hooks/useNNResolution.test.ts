/**
 * Tests for useNNResolution — conflict resolution (acceptServerResolution /
 * keepLocalResolution) delegates to TreeRepository.clearTreeConflict (#296).
 */

const mockResolveNNTree = jest.fn();
const mockClearTreeConflict = jest.fn();

jest.mock('../../src/repositories/TreeRepository', () => ({
  resolveNNTree: (...args: unknown[]) => mockResolveNNTree(...args),
  clearTreeConflict: (...args: unknown[]) => mockClearTreeConflict(...args),
}));

jest.mock('../../src/hooks/useTrees', () => ({
  useTrees: jest.fn().mockReturnValue({ allTrees: [], totalCount: 0, unresolvedNN: 0 }),
}));

jest.mock('../../src/hooks/usePlantationSpecies', () => ({
  usePlantationSpecies: jest.fn().mockReturnValue({ species: [], loading: false }),
}));

jest.mock('../../src/hooks/useProfileData', () => ({
  useProfileData: jest.fn().mockReturnValue({ profile: { rol: 'admin' }, loading: false }),
}));

jest.mock('../../src/queries/plantationDetailQueries', () => ({
  getNNTreesForPlantation: jest.fn(),
}));

const mockPlantationNNTrees: Array<{
  id: string;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  especieId: string | null;
  grupoId: string;
  grupoCodigo?: string;
  conflictEspecieId?: string | null;
  conflictEspecieNombre?: string | null;
}> = [];

const mockEstadoDeEdicion: { estado: string; archivadaEn: string | null } = { estado: 'activa', archivadaEn: null };

jest.mock('../../src/queries/adminQueries', () => ({
  getPlantationEstadoDeEdicion: jest.fn(),
}));

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn().mockImplementation((queryFn: () => unknown) => (
    String(queryFn).includes('getPlantationEstadoDeEdicion')
      ? { data: mockEstadoDeEdicion }
      : { data: mockPlantationNNTrees }
  )),
  notifyDataChanged: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { useNNResolution } from '../../src/hooks/useNNResolution';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlantationNNTrees.length = 0;
  mockEstadoDeEdicion.estado = 'activa';
  mockEstadoDeEdicion.archivadaEn = null;
});

describe('useNNResolution — plantación no editable', () => {
  const nn = { id: 'tree-1', posicion: 1, subId: 'L1NN1', fotoUrl: null, especieId: null, grupoId: 'sg-1', grupoCodigo: 'L1' };

  test('plantación activa → puede resolver', () => {
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.canResolve).toBe(true);
  });

  test('plantación archivada → no puede resolver ni guardar (#477)', async () => {
    mockEstadoDeEdicion.archivadaEn = '2026-09-17T12:00:00+00:00';
    mockPlantationNNTrees.push(nn);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    act(() => result.current.handleSelectSpecies('esp-1'));
    await act(async () => { await result.current.handleGuardar(jest.fn()); });

    expect(result.current.canResolve).toBe(false);
    expect(mockResolveNNTree).not.toHaveBeenCalled();
  });

  test('plantación finalizada → no puede resolver', () => {
    mockEstadoDeEdicion.estado = 'finalizada';
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.canResolve).toBe(false);
  });
});

describe('useNNResolution — conflict resolution', () => {
  const treeWithConflict = {
    id: 'tree-1',
    posicion: 1,
    subId: 'P1L1ANC1',
    fotoUrl: null,
    especieId: null,
    grupoId: 'sg-1',
    grupoCodigo: 'L1',
    conflictEspecieId: 'esp-server',
    conflictEspecieNombre: 'Anco',
  };

  test('getConflictForTree returns the server conflict info', () => {
    mockPlantationNNTrees.push(treeWithConflict);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.getConflictForTree('tree-1')).toEqual({
      serverEspecieId: 'esp-server',
      serverEspecieNombre: 'Anco',
    });
  });

  test('getConflictForTree returns null when the tree has no conflict', () => {
    mockPlantationNNTrees.push({ ...treeWithConflict, conflictEspecieId: null, conflictEspecieNombre: null });
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.getConflictForTree('tree-1')).toBeNull();
  });

  test('acceptServerResolution resolves with the server especie then clears the conflict', async () => {
    mockPlantationNNTrees.push(treeWithConflict);
    mockResolveNNTree.mockResolvedValue(undefined);
    mockClearTreeConflict.mockResolvedValue(undefined);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    await act(async () => {
      await result.current.acceptServerResolution('tree-1');
    });

    expect(mockResolveNNTree).toHaveBeenCalledWith('tree-1', 'esp-server', 'L1');
    expect(mockClearTreeConflict).toHaveBeenCalledWith('tree-1');
    // Order matters: the server resolution must land before the marker clears.
    expect(mockResolveNNTree.mock.invocationCallOrder[0])
      .toBeLessThan(mockClearTreeConflict.mock.invocationCallOrder[0]);
  });

  test('acceptServerResolution does nothing when the tree has no conflict', async () => {
    mockPlantationNNTrees.push({ ...treeWithConflict, conflictEspecieId: null, conflictEspecieNombre: null });
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    await act(async () => {
      await result.current.acceptServerResolution('tree-1');
    });

    expect(mockResolveNNTree).not.toHaveBeenCalled();
    expect(mockClearTreeConflict).not.toHaveBeenCalled();
  });

  test('keepLocalResolution only clears the conflict marker (no resolveNNTree call)', async () => {
    mockPlantationNNTrees.push(treeWithConflict);
    mockClearTreeConflict.mockResolvedValue(undefined);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    await act(async () => {
      await result.current.keepLocalResolution('tree-1');
    });

    expect(mockClearTreeConflict).toHaveBeenCalledWith('tree-1');
    expect(mockResolveNNTree).not.toHaveBeenCalled();
  });
});
