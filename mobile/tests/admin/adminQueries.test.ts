// Tests for adminQueries — admin read queries for plantation management
// Covers: PLAN-06, IDGN-04 and related query behaviors

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
  isSupabaseConfigured: true,
}));

import {
  checkFinalizationGate,
  getMaxGlobalId,
  getPlantationEstado,
  getAllTechnicians,
  getPlantationSpeciesConfig,
  getAssignedTechnicians,
  hasTreesForSpecies,
  hasIdsGenerated,
} from '../../src/queries/adminQueries';

import { db } from '../../src/database/client';
import { supabase } from '../../src/supabase/client';

const mockDb = db as jest.Mocked<typeof db>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('adminQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── checkFinalizationGate ────────────────────────────────────────────────

  describe('checkFinalizationGate', () => {
    it('Test 1: returns {canFinalize: true, blocking: []} when all subgroups are sincronizada', async () => {
      // All subgroups are sincronizada → non-sincronizada query returns empty
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(true);
      expect(result.blocking).toEqual([]);
    });

    it('Test 2: returns {canFinalize: false, blocking: [{nombre, estado}]} when some subgroups are not sincronizada', async () => {
      const nonSyncedSubgroups = [
        { nombre: 'Línea A', estado: 'activa' },
        { nombre: 'Línea B', estado: 'finalizada' },
      ];

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(nonSyncedSubgroups),
        }),
      });

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toHaveLength(2);
      expect(result.blocking[0]).toMatchObject({ nombre: 'Línea A', estado: 'activa' });
      expect(result.blocking[1]).toMatchObject({ nombre: 'Línea B', estado: 'finalizada' });
    });
  });

  // ─── getMaxGlobalId ───────────────────────────────────────────────────────

  describe('getMaxGlobalId', () => {
    it('Test 3: returns 0 when no trees have globalId', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockResolvedValue([{ maxId: null }]),
      });

      const result = await getMaxGlobalId();

      expect(result).toBe(0);
    });

    it('Test 4: returns the max globalId value when trees exist', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockResolvedValue([{ maxId: 42 }]),
      });

      const result = await getMaxGlobalId();

      expect(result).toBe(42);
    });
  });

  // ─── hasIdsGenerated ─────────────────────────────────────────────────────

  describe('hasIdsGenerated', () => {
    it('Test 5: returns false when no tree has globalId', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await hasIdsGenerated('plantation-1');

      expect(result).toBe(false);
    });

    it('Test 6: returns true when at least one tree has globalId', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ id: 'tree-1' }]),
          }),
        }),
      });

      const result = await hasIdsGenerated('plantation-1');

      expect(result).toBe(true);
    });
  });

  // ─── hasTreesForSpecies ───────────────────────────────────────────────────

  describe('hasTreesForSpecies', () => {
    it('Test 7: returns true when trees reference that species in the plantation', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ id: 'tree-1' }]),
          }),
        }),
      });

      const result = await hasTreesForSpecies('plantation-1', 'species-1');

      expect(result).toBe(true);
    });

    it('Test 8: returns false when no trees reference that species', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await hasTreesForSpecies('plantation-1', 'species-1');

      expect(result).toBe(false);
    });
  });
});
