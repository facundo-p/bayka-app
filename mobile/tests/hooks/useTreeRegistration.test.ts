// Tests for useTreeRegistration hook (extracted in Plan 09-02)
// Covers: registerTree, undoLast, executeFinalize (with N/N check context), isReadOnly flag

jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({ back: jest.fn() }),
}));

jest.mock('../../src/repositories/TreeRepository', () => ({
  insertTree: jest.fn(),
  deleteLastTree: jest.fn(),
  reverseTreeOrder: jest.fn(),
  updateTreePhoto: jest.fn(),
  deleteTreeAndRecalculate: jest.fn(),
}));

jest.mock('../../src/repositories/SubGroupRepository', () => ({
  finalizeSubGroup: jest.fn(),
  canEdit: jest.fn(),
  deleteSubGroup: jest.fn(),
  reactivateSubGroup: jest.fn(),
}));

jest.mock('../../src/hooks/useTrees', () => ({
  useTrees: jest.fn().mockReturnValue({
    allTrees: [],
    lastThree: [],
    totalCount: 0,
    unresolvedNN: 0,
  }),
}));

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn(),
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/queries/plantationDetailQueries', () => ({
  getSubgroupById: jest.fn(),
}));

const { insertTree, deleteLastTree } = require('../../src/repositories/TreeRepository');
const { finalizeSubGroup, canEdit } = require('../../src/repositories/SubGroupRepository');
const { useLiveData } = require('../../src/database/liveQuery');
const { useTrees } = require('../../src/hooks/useTrees');

import { renderHook, act } from '@testing-library/react-native';
import { useTreeRegistration } from '../../src/hooks/useTreeRegistration';

const DEFAULT_PARAMS = {
  subgrupoId: 'sg-1',
  plantacionId: 'plant-1',
  subgrupoCodigo: 'L1',
  userId: 'user-1',
};

const mockSubgroup = {
  id: 'sg-1',
  codigo: 'L1',
  tipo: 'linea',
  estado: 'activa',
  usuarioCreador: 'user-1',
};

describe('useTreeRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: subgroup is activa, user is owner
    (useLiveData as jest.Mock).mockReturnValue({ data: [mockSubgroup] });
    (canEdit as jest.Mock).mockReturnValue(true);
    (useTrees as jest.Mock).mockReturnValue({
      allTrees: [],
      lastThree: [],
      totalCount: 0,
      unresolvedNN: 0,
    });
    (insertTree as jest.Mock).mockResolvedValue({ id: 'tree-new', posicion: 1, subId: 'L1ANC1' });
    (deleteLastTree as jest.Mock).mockResolvedValue({ deleted: true });
    (finalizeSubGroup as jest.Mock).mockResolvedValue({ success: true });
  });

  describe('registerTree', () => {
    it('calls insertTree with correct params when subgroup is active and user is owner', async () => {
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(insertTree).toHaveBeenCalledWith({
        subgrupoId: 'sg-1',
        subgrupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });
    });

    it('does NOT call insertTree when subgroup is read-only (finalizada)', async () => {
      (useLiveData as jest.Mock).mockReturnValue({
        data: [{ ...mockSubgroup, estado: 'finalizada' }],
      });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(insertTree).not.toHaveBeenCalled();
    });

    it('does NOT call insertTree when userId is empty', async () => {
      const { result } = renderHook(() => useTreeRegistration({
        ...DEFAULT_PARAMS,
        userId: '',
      }));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(insertTree).not.toHaveBeenCalled();
    });
  });

  describe('undoLast', () => {
    it('calls deleteLastTree with subgrupoId when subgroup is active', async () => {
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.undoLast();
      });

      expect(deleteLastTree).toHaveBeenCalledWith('sg-1');
    });

    it('does NOT call deleteLastTree when subgroup is read-only', async () => {
      (useLiveData as jest.Mock).mockReturnValue({
        data: [{ ...mockSubgroup, estado: 'sincronizada' }],
      });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.undoLast();
      });

      expect(deleteLastTree).not.toHaveBeenCalled();
    });
  });

  describe('executeFinalize', () => {
    it('calls finalizeSubGroup with subgrupoId', async () => {
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.executeFinalize();
      });

      expect(finalizeSubGroup).toHaveBeenCalledWith('sg-1');
    });

    it('navigates back after successful finalization', async () => {
      const mockBack = jest.fn();
      const { useRouter } = require('expo-router');
      (useRouter as jest.Mock).mockReturnValue({ back: mockBack });

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.executeFinalize();
      });

      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('derived state', () => {
    it('isReadOnly is false when subgroup is activa and user is owner', () => {
      (canEdit as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.isReadOnly).toBe(false);
    });

    it('isReadOnly is true when subgroup is finalizada', () => {
      (useLiveData as jest.Mock).mockReturnValue({
        data: [{ ...mockSubgroup, estado: 'finalizada' }],
      });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.isReadOnly).toBe(true);
    });

    it('canReactivate is true when user is creator and state is finalizada', () => {
      (useLiveData as jest.Mock).mockReturnValue({
        data: [{ ...mockSubgroup, estado: 'finalizada', usuarioCreador: 'user-1' }],
      });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.canReactivate).toBe(true);
    });

    it('unresolvedNN and totalCount come from useTrees', () => {
      (useTrees as jest.Mock).mockReturnValue({
        allTrees: [],
        lastThree: [],
        totalCount: 5,
        unresolvedNN: 3,
      });

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.unresolvedNN).toBe(3);
      expect(result.current.totalCount).toBe(5);
    });
  });
});
