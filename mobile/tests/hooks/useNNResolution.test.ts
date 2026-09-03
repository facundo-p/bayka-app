/**
 * Tests for useNNResolution — focused on the #296 refactor: conflict
 * resolution (acceptServerResolution / keepLocalResolution) now delegates to
 * TreeRepository.clearTreeConflict instead of running db.update() inline.
 */

const mockResolveNNTree = jest.fn();
const mockClearTreeConflict = jest.fn();

jest.mock('../../src/repositories/TreeRepository', () => ({
  resolveNNTree: (...args: unknown[]) => mockResolveNNTree(...args),
  clearTreeConflict: (...args: unknown[]) => mockClearTreeConflict(...args),
}));

jest.mock('../../src/hooks/useTrees', () => ({
  useTrees: jest.fn().mockReturnValue({ allTrees: [], lastThree: [], totalCount: 0, unresolvedNN: 0 }),
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

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn().mockImplementation(() => ({ data: mockPlantationNNTrees })),
  notifyDataChanged: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { useNNResolution } from '../../src/hooks/useNNResolution';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlantationNNTrees.length = 0;
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
