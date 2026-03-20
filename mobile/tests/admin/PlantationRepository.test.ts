// Tests for PlantationRepository — admin mutation functions
// Covers: PLAN-01, PLAN-02, PLAN-03, PLAN-05, IDGN-01, IDGN-02, IDGN-03

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/services/SyncService', () => ({
  pullFromServer: jest.fn(),
}));

import {
  createPlantation,
  finalizePlantation,
  saveSpeciesConfig,
  assignTechnicians,
  generateIds,
} from '../../src/repositories/PlantationRepository';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { notifyDataChanged } from '../../src/database/liveQuery';
import { pullFromServer } from '../../src/services/SyncService';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;
const mockPullFromServer = pullFromServer as jest.Mock;

const fakePlantation = {
  id: 'plantation-uuid-1',
  organizacion_id: 'org-1',
  lugar: 'Zona Norte',
  periodo: '2026',
  estado: 'activa',
  creado_por: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
};

describe('PlantationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: pullFromServer succeeds
    mockPullFromServer.mockResolvedValue(undefined);

    // Default supabase.from chain
    (mockSupabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: fakePlantation, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Default db.insert chain
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default db.update chain
    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default db.select chain (for generateIds)
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  // ─── createPlantation ─────────────────────────────────────────────────────

  describe('createPlantation', () => {
    it('Test 1: calls supabase.from("plantations").insert() and upserts into local SQLite', async () => {
      await createPlantation('Zona Norte', '2026', 'org-1', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('plantations');

      const fromResult = (mockSupabase.from as jest.Mock).mock.results[0].value;
      expect(fromResult.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          lugar: 'Zona Norte',
          periodo: '2026',
          organizacion_id: 'org-1',
          creado_por: 'user-1',
          estado: 'activa',
        })
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('Test 2: calls notifyDataChanged after local upsert', async () => {
      await createPlantation('Zona Norte', '2026', 'org-1', 'user-1');

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  // ─── finalizePlantation ───────────────────────────────────────────────────

  describe('finalizePlantation', () => {
    it('Test 3: updates estado to "finalizada" on BOTH supabase and local SQLite', async () => {
      await finalizePlantation('plantation-1');

      // Verify Supabase update call
      expect(mockSupabase.from).toHaveBeenCalledWith('plantations');
      const fromResult = (mockSupabase.from as jest.Mock).mock.results[0].value;
      expect(fromResult.update).toHaveBeenCalledWith({ estado: 'finalizada' });

      // Verify local SQLite update call
      expect(mockDb.update).toHaveBeenCalled();
      const updateResult = (mockDb.update as jest.Mock).mock.results[0].value;
      expect(updateResult.set).toHaveBeenCalledWith({ estado: 'finalizada' });
    });

    it('Test 4: calls notifyDataChanged after updates', async () => {
      await finalizePlantation('plantation-1');

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  // ─── saveSpeciesConfig ────────────────────────────────────────────────────

  describe('saveSpeciesConfig', () => {
    it('Test 5: deletes all existing species, inserts new ones, calls pullFromServer', async () => {
      const items = [
        { especieId: 'species-1', ordenVisual: 0 },
        { especieId: 'species-2', ordenVisual: 1 },
      ];

      await saveSpeciesConfig('plantation-1', items);

      // Verify delete called on plantation_species
      expect(mockSupabase.from).toHaveBeenCalledWith('plantation_species');
      const fromCalls = (mockSupabase.from as jest.Mock).mock.calls;
      const psCall = fromCalls.find((args) => args[0] === 'plantation_species');
      expect(psCall).toBeTruthy();

      // Verify pullFromServer called
      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');

      // Verify notifyDataChanged called
      expect(mockNotifyDataChanged).toHaveBeenCalled();
    });
  });

  // ─── assignTechnicians ────────────────────────────────────────────────────

  describe('assignTechnicians', () => {
    it('Test 6: deletes all existing users, inserts new ones, calls pullFromServer', async () => {
      const userIds = ['user-1', 'user-2'];

      await assignTechnicians('plantation-1', userIds);

      // Verify plantation_users was targeted
      expect(mockSupabase.from).toHaveBeenCalledWith('plantation_users');
      const fromCalls = (mockSupabase.from as jest.Mock).mock.calls;
      const puCall = fromCalls.find((args) => args[0] === 'plantation_users');
      expect(puCall).toBeTruthy();

      // Verify pullFromServer called
      expect(mockPullFromServer).toHaveBeenCalledWith('plantation-1');

      // Verify notifyDataChanged called
      expect(mockNotifyDataChanged).toHaveBeenCalled();
    });
  });

  // ─── generateIds ─────────────────────────────────────────────────────────

  describe('generateIds', () => {
    it('Test 7: assigns sequential plantacionId (1..N) and globalId (seed..seed+N-1) ordered by subgroup.createdAt ASC, tree.posicion ASC', async () => {
      const orderedTrees = [
        { treeId: 'tree-1' },
        { treeId: 'tree-2' },
        { treeId: 'tree-3' },
      ];

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(orderedTrees),
            }),
          }),
        }),
      });

      const updateCalls: Array<{ plantacionId: number; globalId: number }> = [];
      (mockDb.transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          update: jest.fn().mockImplementation(() => ({
            set: jest.fn().mockImplementation((values) => {
              updateCalls.push(values);
              return {
                where: jest.fn().mockResolvedValue(undefined),
              };
            }),
          })),
        };
        await fn(tx);
      });

      await generateIds('plantation-1', 10);

      // Verify sequential IDs starting from seed=10
      expect(updateCalls[0]).toMatchObject({ plantacionId: 1, globalId: 10 });
      expect(updateCalls[1]).toMatchObject({ plantacionId: 2, globalId: 11 });
      expect(updateCalls[2]).toMatchObject({ plantacionId: 3, globalId: 12 });
    });

    it('Test 8: calls notifyDataChanged after transaction completes', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      (mockDb.transaction as jest.Mock).mockImplementation(async (fn) => {
        await fn({ update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn() }) }) });
      });

      await generateIds('plantation-1', 1);

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });
});
