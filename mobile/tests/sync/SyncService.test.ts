// Tests for SyncService — implemented in Plan 03-02
// Covers: SYNC-01, SYNC-04, SYNC-05, SYNC-06

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/repositories/SubGroupRepository', () => ({
  markAsSincronizada: jest.fn(),
  getFinalizadaSubGroups: jest.fn(),
}));

import {
  syncPlantation,
  uploadSubGroup,
  getErrorMessage,
  SyncSubGroupResult,
  SyncProgress,
} from '../../src/services/SyncService';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { markAsSincronizada, getFinalizadaSubGroups } from '../../src/repositories/SubGroupRepository';
import { notifyDataChanged } from '../../src/database/liveQuery';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockGetFinalizadaSubGroups = getFinalizadaSubGroups as jest.Mock;
const mockMarkAsSincronizada = markAsSincronizada as jest.Mock;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;
const mockDb = db as jest.Mocked<typeof db>;

const makeSg = (id: string, nombre = 'Línea A') => ({
  id,
  plantacionId: 'plantation-1',
  nombre,
  codigo: 'LA',
  tipo: 'linea' as const,
  estado: 'finalizada' as const,
  usuarioCreador: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
});

const makeTrees = (subgrupoId: string) => [
  {
    id: 'tree-1',
    subgrupoId,
    especieId: 'species-1',
    posicion: 1,
    subId: 'LA-SP-1',
    fotoUrl: null,
    plantacionId: 1,
    globalId: 1,
    usuarioRegistro: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth session mock
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: {} }, error: null });

    // Default: no pending subgroups
    mockGetFinalizadaSubGroups.mockResolvedValue([]);

    // Default: empty trees select
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    // Default: supabase.from chain for pull
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    // Default: db.insert chain for upsert
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    });
  });

  describe('syncPlantation — pull-then-push order (SYNC-01)', () => {
    it('Test 1: calls pullFromServer (supabase.from) BEFORE uploading any SubGroups', async () => {
      const callOrder: string[] = [];

      (mockSupabase.from as jest.Mock).mockImplementation(() => {
        callOrder.push('pull');
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockImplementation(() => {
        callOrder.push('rpc_upload');
        return Promise.resolve({ data: { success: true }, error: null });
      });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await syncPlantation('plantation-1');

      // Pull (from calls) should happen before upload (rpc call)
      const firstPullIndex = callOrder.indexOf('pull');
      const firstRpcIndex = callOrder.indexOf('rpc_upload');
      expect(firstPullIndex).toBeGreaterThanOrEqual(0);
      expect(firstRpcIndex).toBeGreaterThan(firstPullIndex);
    });
  });

  describe('uploadSubGroup — RPC payload (SYNC-04)', () => {
    it('Test 2: calls supabase.rpc with correct p_subgroup and p_trees payload', async () => {
      const sg = makeSg('sg-1');
      const sgTrees = makeTrees('sg-1');

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      const sg1 = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg1]);

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(sgTrees),
        }),
      });

      await syncPlantation('plantation-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('sync_subgroup', {
        p_subgroup: {
          id: 'sg-1',
          plantation_id: 'plantation-1',
          nombre: 'Línea A',
          codigo: 'LA',
          tipo: 'linea',
          usuario_creador: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
        },
        p_trees: [
          {
            id: 'tree-1',
            subgroup_id: 'sg-1',
            species_id: 'species-1',
            posicion: 1,
            sub_id: 'LA-SP-1',
            foto_url: null,
            usuario_registro: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });
    });
  });

  describe('markAsSincronizada state transitions (SYNC-05)', () => {
    it('Test 3: calls markAsSincronizada when RPC returns success: true', async () => {
      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await syncPlantation('plantation-1');

      expect(mockMarkAsSincronizada).toHaveBeenCalledWith('sg-1');
    });

    it('Test 4: does NOT call markAsSincronizada on DUPLICATE_CODE error', async () => {
      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: false, error: 'DUPLICATE_CODE' },
        error: null,
      });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(mockMarkAsSincronizada).not.toHaveBeenCalled();
      expect(results[0].success).toBe(false);
      if (!results[0].success) {
        expect(results[0].error).toBe('DUPLICATE_CODE');
      }
    });

    it('Test 5: does NOT call markAsSincronizada on network error', async () => {
      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockRejectedValue(new Error('Network Error'));

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(mockMarkAsSincronizada).not.toHaveBeenCalled();
      expect(results[0].success).toBe(false);
      if (!results[0].success) {
        expect(results[0].error).toBe('NETWORK');
      }
    });
  });

  describe('error accumulation — continue-on-failure (SYNC-06)', () => {
    it('Test 6: all 3 SubGroups attempted even when 2nd fails', async () => {
      const sg1 = makeSg('sg-1', 'Línea A');
      const sg2 = makeSg('sg-2', 'Línea B');
      const sg3 = makeSg('sg-3', 'Línea C');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg1, sg2, sg3]);

      (mockSupabase.rpc as jest.Mock)
        .mockResolvedValueOnce({ data: { success: true }, error: null })
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('getErrorMessage — Spanish error messages', () => {
    it('Test 7: DUPLICATE_CODE returns Spanish message containing "ya existe"', () => {
      const msg = getErrorMessage('DUPLICATE_CODE');
      expect(msg).toMatch(/ya existe/i);
    });

    it('Test 8: NETWORK returns Spanish message containing "conexion"', () => {
      const msg = getErrorMessage('NETWORK');
      expect(msg).toMatch(/conexion/i);
    });
  });
});
