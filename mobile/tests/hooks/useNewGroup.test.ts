/**
 * Tests for useNewGroup — validates last-group-name loading (including the
 * stale-response guard on unmount/plantacionId change and the .catch on
 * failure) and that handleCreateGroup forwards to GroupRepository correctly.
 */

const mockCreateGroup = jest.fn();
const mockGetLastGroupName = jest.fn();

jest.mock('../../src/repositories/GroupRepository', () => ({
  createGroup: (params: unknown) => mockCreateGroup(params),
  getLastGroupName: (plantacionId: string) => mockGetLastGroupName(plantacionId),
}));

jest.mock('../../src/hooks/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user-1',
}));

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useNewGroup } from '../../src/hooks/useNewGroup';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNewGroup', () => {
  describe('lastGroupName loading', () => {
    test('does not query when plantacionId is undefined', () => {
      renderHook(() => useNewGroup(undefined));
      expect(mockGetLastGroupName).not.toHaveBeenCalled();
    });

    test('loads and exposes the last group name for the plantation', async () => {
      mockGetLastGroupName.mockResolvedValue('Linea 3');
      const { result } = renderHook(() => useNewGroup('plant-1'));

      await waitFor(() => expect(result.current.lastGroupName).toBe('Linea 3'));
      expect(mockGetLastGroupName).toHaveBeenCalledWith('plant-1');
    });

    test('falls back to null (not an unhandled rejection) when the query fails', async () => {
      mockGetLastGroupName.mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() => useNewGroup('plant-1'));

      await waitFor(() => expect(mockGetLastGroupName).toHaveBeenCalled());
      // Flush the rejected promise's .catch handler.
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.lastGroupName).toBeNull();
    });

    test('ignores a stale response after plantacionId changes before it resolves', async () => {
      let resolveFirst!: (name: string | null) => void;
      mockGetLastGroupName.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; })
      );
      mockGetLastGroupName.mockResolvedValueOnce('Linea B');

      const { result, rerender } = renderHook(
        ({ plantacionId }) => useNewGroup(plantacionId),
        { initialProps: { plantacionId: 'plant-1' } }
      );

      rerender({ plantacionId: 'plant-2' });
      await waitFor(() => expect(mockGetLastGroupName).toHaveBeenCalledTimes(2));

      // The stale first-effect response for plant-1 resolves after the switch.
      await act(async () => {
        resolveFirst('Linea A (stale)');
        await Promise.resolve();
      });

      expect(result.current.lastGroupName).not.toBe('Linea A (stale)');
    });
  });

  describe('handleCreateGroup', () => {
    test('returns unknown error without calling createGroup when userId/plantacionId/parcelaId missing', async () => {
      const { result } = renderHook(() => useNewGroup('plant-1'));
      const outcome = await result.current.handleCreateGroup({ nombre: 'L1', codigo: 'L1', tipo: 'linea' as any });
      expect(outcome).toEqual({ success: false, error: 'unknown' });
      expect(mockCreateGroup).not.toHaveBeenCalled();
    });

    test('forwards to createGroup with plantacionId/parcelaId/userId when all present', async () => {
      mockCreateGroup.mockResolvedValue({ success: true, id: 'sg-1' });
      const { result } = renderHook(() => useNewGroup('plant-1', 'parc-1'));

      const outcome = await result.current.handleCreateGroup({ nombre: 'Linea 1', codigo: 'L1', tipo: 'linea' as any });

      expect(mockCreateGroup).toHaveBeenCalledWith({
        plantacionId: 'plant-1',
        parcelaId: 'parc-1',
        nombre: 'Linea 1',
        codigo: 'L1',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });
      expect(outcome).toEqual({ success: true, id: 'sg-1' });
    });
  });
});
