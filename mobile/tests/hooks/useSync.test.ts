// Tests for useSync hook
// Covers: startBidirectionalSync (calls syncPlantation), startGlobalSync (calls syncAllPlantations),
//         notifyDataChanged in finally, state transitions

jest.mock('../../src/services/SyncService', () => ({
  syncPlantation: jest.fn(),
  syncAllPlantations: jest.fn(),
  uploadPendingPhotos: jest.fn().mockResolvedValue({ uploaded: 0, failed: 0 }),
  downloadPhotosForPlantation: jest.fn().mockResolvedValue({ downloaded: 0, failed: 0 }),
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

const { syncPlantation, syncAllPlantations } = require('../../src/services/SyncService');
const { notifyDataChanged } = require('../../src/database/liveQuery');

import { renderHook, act } from '@testing-library/react-native';
import { useSync } from '../../src/hooks/useSync';

describe('useSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startBidirectionalSync', () => {
    it('calls syncPlantation with the correct plantacionId', async () => {
      (syncPlantation as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
      });

      expect(syncPlantation).toHaveBeenCalledWith('plant-1', expect.any(Function));
    });

    it('transitions state from idle → pushing → done', async () => {
      let resolveSync: () => void;
      (syncPlantation as jest.Mock).mockImplementation(() =>
        new Promise<any[]>((resolve) => {
          resolveSync = () => resolve([]);
        })
      );

      const { result } = renderHook(() => useSync('plant-1'));

      expect(result.current.state).toBe('idle');

      act(() => {
        result.current.startBidirectionalSync();
      });

      // State should be 'pushing' while promise is pending
      expect(result.current.state).toBe('pushing');

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
        await result.current.startBidirectionalSync();
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
        await result.current.startBidirectionalSync();
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
        await result.current.startBidirectionalSync();
      });

      expect(result.current.hasFailures).toBe(false);
    });

    it('sets pullSuccess=true on successful sync', async () => {
      (syncPlantation as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
      });

      expect(result.current.pullSuccess).toBe(true);
    });

    it('sets pullSuccess=false when sync throws', async () => {
      (syncPlantation as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
      });

      expect(result.current.pullSuccess).toBe(false);
    });
  });

  describe('startGlobalSync', () => {
    it('calls syncAllPlantations', async () => {
      (syncAllPlantations as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.startGlobalSync();
      });

      expect(syncAllPlantations).toHaveBeenCalledWith(expect.any(Function), true);
    });

    it('flattens results from all plantations', async () => {
      const mockAllResults = [
        { plantationId: 'p-1', plantationName: 'Finca A', results: [{ success: true, subgroupId: 'sg-1', nombre: 'L1' }] },
        { plantationId: 'p-2', plantationName: 'Finca B', results: [{ success: false, subgroupId: 'sg-2', nombre: 'L2', error: 'NETWORK' as const }] },
      ];
      (syncAllPlantations as jest.Mock).mockResolvedValue(mockAllResults);

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.startGlobalSync();
      });

      expect(result.current.results).toHaveLength(2);
      expect(result.current.successCount).toBe(1);
      expect(result.current.failureCount).toBe(1);
    });

    it('calls notifyDataChanged in finally block even on error', async () => {
      (syncAllPlantations as jest.Mock).mockRejectedValue(new Error('Global sync failed'));

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.startGlobalSync();
      });

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
      expect(result.current.state).toBe('done');
    });
  });

  describe('reset', () => {
    it('resets state to idle and clears results', async () => {
      (syncPlantation as jest.Mock).mockResolvedValue([
        { success: true, subgroupId: 'sg-1', nombre: 'Linea A' },
      ]);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
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
