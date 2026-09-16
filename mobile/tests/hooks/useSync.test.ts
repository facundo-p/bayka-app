// Tests for useSync hook

// Se stubea el comportamiento (las funciones de sync), no el contrato: las constantes
// salen de sync/types, que no tiene side effects. Si se mockea el módulo entero,
// SYNC_STATE llega undefined al hook.
jest.mock('../../src/services/SyncService', () => ({
  ...jest.requireActual('../../src/services/sync/types'),
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

      expect(syncPlantation).toHaveBeenCalledWith('plant-1', expect.objectContaining({
        onProgress: expect.any(Function),
        onPhaseProgress: expect.any(Function),
        onParcelaResults: expect.any(Function),
        onPlantationResults: expect.any(Function),
        onPullResult: expect.any(Function),
      }));
    });

    // El pull ocupa el principio de la corrida: antes `pushing` se seteaba de entrada
    // y el pull entero corría mostrando "Subiendo grupos..." (#447).
    it('transitions state from idle → pulling → pushing → done', async () => {
      let resolveSync: () => void;
      let emitirProgresoDePush: (() => void) | undefined;
      (syncPlantation as jest.Mock).mockImplementation((_id: string, callbacks: any) =>
        new Promise<any[]>((resolve) => {
          emitirProgresoDePush = () =>
            callbacks.onProgress?.({ total: 2, completed: 0, currentName: 'Línea A' });
          resolveSync = () => resolve([]);
        })
      );

      const { result } = renderHook(() => useSync('plant-1'));

      expect(result.current.state).toBe('idle');

      act(() => {
        result.current.startBidirectionalSync();
      });

      expect(result.current.state).toBe('pulling');

      act(() => {
        emitirProgresoDePush!();
      });

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
        { success: true, groupId: 'sg-1', nombre: 'Linea A' },
        { success: false, groupId: 'sg-2', nombre: 'Linea B', error: 'NETWORK' as const },
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

    it('surfaces parcela failures from syncPlantation via onParcelaResults', async () => {
      const parcelaFailures = [
        { success: false, parcelaId: 'parc-1', nombre: 'Lote A', error: 'UNKNOWN' as const },
      ];
      // 3rd callback arg delivers parcela results; return value is the (blocked) group results.
      (syncPlantation as jest.Mock).mockImplementation(
        (_id: string, callbacks: { onParcelaResults?: (p: any[]) => void }) => {
          callbacks.onParcelaResults?.(parcelaFailures);
          return Promise.resolve([
            { success: false, groupId: 'sg-1', nombre: 'Linea 1', error: 'PARCELA_PENDING' as const, parcelaId: 'parc-1' },
          ]);
        }
      );

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
      });

      expect(result.current.parcelaResults).toEqual(parcelaFailures);
      expect(result.current.parcelaFailureCount).toBe(1);
      expect(result.current.hasFailures).toBe(true);
    });

    it('surfaces plantation push failures from syncPlantation via onPlantationResults', async () => {
      const plantationFailures = [
        { success: false, plantacionId: 'pl-1', nombre: 'Finca X', error: 'UNKNOWN' as const, detail: '23503: foreign key' },
      ];
      // 4th callback arg delivers plantation push results.
      (syncPlantation as jest.Mock).mockImplementation(
        (_id: string, callbacks: { onPlantationResults?: (p: any[]) => void }) => {
          callbacks.onPlantationResults?.(plantationFailures);
          return Promise.resolve([]);
        }
      );

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
      });

      expect(result.current.plantationResults).toEqual(plantationFailures);
      expect(result.current.plantationFailureCount).toBe(1);
      expect(result.current.hasFailures).toBe(true);
    });

    it('reports no failures when all groups sync successfully', async () => {
      (syncPlantation as jest.Mock).mockResolvedValue([
        { success: true, groupId: 'sg-1', nombre: 'Linea A' },
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

    it('sets authExpired when syncPlantation throws SessionExpiredError', async () => {
      const expiredErr = Object.assign(new Error('SESSION_EXPIRED'), { name: 'SessionExpiredError' });
      (syncPlantation as jest.Mock).mockRejectedValue(expiredErr);

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
      });

      expect(result.current.authExpired).toBe(true);
      expect(result.current.state).toBe('done');
    });

    it('does NOT set authExpired for a generic sync error', async () => {
      (syncPlantation as jest.Mock).mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() => useSync('plant-1'));

      await act(async () => {
        await result.current.startBidirectionalSync();
      });

      expect(result.current.authExpired).toBe(false);
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

      expect(syncAllPlantations).toHaveBeenCalledWith(expect.any(Function), true, expect.any(Function));
    });

    it('flattens results from all plantations', async () => {
      const mockAllResults = [
        { plantationId: 'p-1', plantationName: 'Finca A', results: [{ success: true, groupId: 'sg-1', nombre: 'L1' }] },
        { plantationId: 'p-2', plantationName: 'Finca B', results: [{ success: false, groupId: 'sg-2', nombre: 'L2', error: 'NETWORK' as const }] },
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

    it('surfaces parcela failures flattened from all plantations', async () => {
      const mockAllResults = [
        { plantationId: 'p-1', plantationName: 'Finca A', results: [], parcelas: [
          { success: false, parcelaId: 'parc-1', nombre: 'Lote A', error: 'PERMISSION' as const },
        ] },
        { plantationId: 'p-2', plantationName: 'Finca B', results: [], parcelas: [
          { success: true, parcelaId: 'parc-2', nombre: 'Lote B' },
        ] },
      ];
      (syncAllPlantations as jest.Mock).mockResolvedValue(mockAllResults);

      const { result } = renderHook(() => useSync());

      await act(async () => {
        await result.current.startGlobalSync();
      });

      expect(result.current.parcelaResults).toHaveLength(2);
      expect(result.current.parcelaFailureCount).toBe(1);
      expect(result.current.hasFailures).toBe(true);
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
        { success: true, groupId: 'sg-1', nombre: 'Linea A' },
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

describe('useSync — el progreso de fotos no queda pegado entre fases (#450)', () => {
  beforeEach(() => jest.clearAllMocks());

  // Una fase sin fotos no emite nada, así que el estado viejo sobrevive: con la
  // velocidad adentro, eso se ve como una transferencia arrastrándose.
  it('la bajada sin fotos no hereda el contador de la subida', async () => {
    (syncPlantation as jest.Mock).mockResolvedValue([]);
    const { uploadPendingPhotos, downloadPhotosForPlantation } = require('../../src/services/SyncService');
    (uploadPendingPhotos as jest.Mock).mockImplementation(async (_id: string, onProgress: any) => {
      onProgress?.({ total: 2, completed: 2, bytes: 4_000_000, desde: Date.now() });
      return { uploaded: 2, failed: 0 };
    });
    (downloadPhotosForPlantation as jest.Mock).mockResolvedValue({ downloaded: 0, failed: 0 });
    const { result } = renderHook(() => useSync('plant-1'));

    await act(async () => { await result.current.startBidirectionalSync(true); });

    expect(result.current.photoProgress).toBeNull();
  });
});
