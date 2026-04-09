// Tests for useSync hook
// Covers: startSync (calls syncPlantation), startPull (calls pullFromServer),
//         notifyDataChanged in finally, state transitions

jest.mock('../../src/services/SyncService', () => ({
  syncPlantation: jest.fn(),
  pullFromServer: jest.fn(),
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

const { syncPlantation, pullFromServer } = require('../../src/services/SyncService');
const { notifyDataChanged } = require('../../src/database/liveQuery');

import { renderHook, act } from '@testing-library/react-native';
import { useSync } from '../../src/hooks/useSync';

describe('useSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startSync', () => {
    it('calls syncPlantation with the correct plantacionId', async () => {
      (syncPlantation as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startSync();
      });

      expect(syncPlantation).toHaveBeenCalledWith('plant-1', expect.any(Function));
    });

    it('transitions state from idle → syncing → done', async () => {
      let resolveSync: () => void;
      (syncPlantation as jest.Mock).mockImplementation(() =>
        new Promise<any[]>((resolve) => {
          resolveSync = () => resolve([]);
        })
      );

      const { result } = renderHook(() => useSync('plant-1'));

      expect(result.current.state).toBe('idle');

      act(() => {
        result.current.startSync();
      });

      // State should be 'syncing' while promise is pending
      expect(result.current.state).toBe('syncing');

      await act(async () => {
        resolveSync!();
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.state).toBe('done');
    });

    it('calls notifyDataChanged in finally block even on error', async () => {
      (syncPlantation as jest.Mock).mockRejectedValue(new Error('Sync failed'));

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startSync();
      });

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
      expect(result.current.state).toBe('done');
    });

    it('stores sync results from syncPlantation in results state', async () => {
      const mockResults = [
        { success: true, subgroupId: 'sg-1', nombre: 'Linea A' },
        { success: false, subgroupId: 'sg-2', nombre: 'Linea B', error: 'NETWORK' as const },
      ];
      (syncPlantation as jest.Mock).mockResolvedValue(mockResults);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startSync();
      });

      expect(result.current.results).toEqual(mockResults);
      expect(result.current.hasFailures).toBe(true);
      expect(result.current.successCount).toBe(1);
      expect(result.current.failureCount).toBe(1);
    });

    it('reports no failures when all subgroups sync successfully', async () => {
      (syncPlantation as jest.Mock).mockResolvedValue([
        { success: true, subgroupId: 'sg-1', nombre: 'Linea A' },
      ]);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startSync();
      });

      expect(result.current.hasFailures).toBe(false);
    });
  });

  describe('startPull', () => {
    it('calls pullFromServer with the correct plantacionId', async () => {
      (pullFromServer as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useSync('plant-2'));

      await act(async () => {
        await result.current.startPull();
      });

      expect(pullFromServer).toHaveBeenCalledWith('plant-2');
    });

    it('sets pullSuccess=true when pull succeeds', async () => {
      (pullFromServer as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useSync('plant-2'));

      await act(async () => {
        await result.current.startPull();
      });

      expect(result.current.pullSuccess).toBe(true);
    });

    it('sets pullSuccess=false when pull fails', async () => {
      (pullFromServer as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSync('plant-2'));

      await act(async () => {
        await result.current.startPull();
      });

      expect(result.current.pullSuccess).toBe(false);
    });

    it('calls notifyDataChanged in finally block even on pull error', async () => {
      (pullFromServer as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const { result } = renderHook(() => useSync('plant-2'));

      await act(async () => {
        await result.current.startPull();
      });

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('resets state to idle and clears results', async () => {
      (syncPlantation as jest.Mock).mockResolvedValue([
        { success: true, subgroupId: 'sg-1', nombre: 'Linea A' },
      ]);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startSync();
      });

      expect(result.current.state).toBe('done');

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.results).toEqual([]);
    });
  });
});
