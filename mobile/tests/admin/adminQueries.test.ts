// Tests for adminQueries — admin read queries for plantation management
// Covers: checkFinalizationGate (all states including sincronizada),
// getMaxGlobalId, hasIdsGenerated, hasTreesForSpecies

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

/**
 * Helper: sets up mockDb.select to return different results on sequential calls.
 * Call 1: subgroups query (used by checkFinalizationGate)
 * Call 2: N/N trees query (used by checkFinalizationGate for unresolvedNNCount)
 */
function setupFinalizationMocks(subgroups: any[], nnRows: any[] = []) {
  let callCount = 0;
  (mockDb.select as jest.Mock).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // Subgroups query
      return {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(subgroups),
        }),
      };
    }
    // N/N trees query
    return {
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          groupBy: jest.fn().mockResolvedValue(nnRows),
        }),
      }),
    };
  });
}

describe('adminQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── checkFinalizationGate ────────────────────────────────────────────────

  describe('checkFinalizationGate', () => {
    it('canFinalize=true cuando todos los subgrupos están finalizada + pendingSync=false + sin N/N', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'finalizada', pendingSync: false },
          { nombre: 'Línea B', estado: 'finalizada', pendingSync: false },
        ],
        [] // no N/N trees
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(true);
      expect(result.blocking).toEqual([]);
      expect(result.hasSubgroups).toBe(true);
      expect(result.unresolvedNNCount).toBe(0);
      expect(result.unresolvedNNSubgroups).toBe(0);
    });

    it('canFinalize=true cuando todos los subgrupos están sincronizada + pendingSync=false', async () => {
      // After Phase 14: subgroups go finalizada → sincronizada on sync.
      // sincronizada is a valid "done" state for plantation finalization.
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'sincronizada', pendingSync: false },
          { nombre: 'Línea B', estado: 'sincronizada', pendingSync: false },
        ],
        []
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(true);
      expect(result.blocking).toEqual([]);
    });

    it('canFinalize=true con mezcla de finalizada y sincronizada', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'finalizada', pendingSync: false },
          { nombre: 'Línea B', estado: 'sincronizada', pendingSync: false },
        ],
        []
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(true);
      expect(result.blocking).toEqual([]);
    });

    it('canFinalize=false cuando hay subgrupos activa', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'activa', pendingSync: false },
          { nombre: 'Línea B', estado: 'finalizada', pendingSync: false },
        ],
        []
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0]).toMatchObject({ nombre: 'Línea A', estado: 'activa' });
    });

    it('canFinalize=false cuando hay subgrupos con pendingSync=true', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'finalizada', pendingSync: true },
          { nombre: 'Línea B', estado: 'sincronizada', pendingSync: false },
        ],
        []
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0]).toMatchObject({ nombre: 'Línea A', pendingSync: true });
    });

    it('canFinalize=false cuando no hay subgrupos', async () => {
      setupFinalizationMocks([], []);

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.hasSubgroups).toBe(false);
    });

    it('canFinalize=false cuando hay N/N sin resolver', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'finalizada', pendingSync: false },
        ],
        [
          { subgrupoId: 'sg-1', cnt: 3 }, // 3 unresolved N/N trees
        ]
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toEqual([]); // subgroups are fine
      expect(result.unresolvedNNCount).toBe(3);
      expect(result.unresolvedNNSubgroups).toBe(1);
    });

    it('canFinalize=false con mezcla de blocking + N/N sin resolver', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'activa', pendingSync: false },
          { nombre: 'Línea B', estado: 'sincronizada', pendingSync: false },
        ],
        [
          { subgrupoId: 'sg-b', cnt: 2 },
        ]
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toHaveLength(1); // Línea A is activa
      expect(result.unresolvedNNCount).toBe(2);
    });

    it('sincronizada con pendingSync=true bloquea finalización', async () => {
      // Edge case: subgroup was synced but then N/N was resolved locally
      // (pendingSync=true, estado=sincronizada)
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'sincronizada', pendingSync: true },
        ],
        []
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0]).toMatchObject({ nombre: 'Línea A', pendingSync: true });
    });
  });

  // ─── getMaxGlobalId ───────────────────────────────────────────────────────

  describe('getMaxGlobalId', () => {
    it('retorna 0 cuando ningún árbol tiene globalId', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockResolvedValue([{ maxId: null }]),
      });

      const result = await getMaxGlobalId();
      expect(result).toBe(0);
    });

    it('retorna el max globalId cuando existen árboles', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockResolvedValue([{ maxId: 42 }]),
      });

      const result = await getMaxGlobalId();
      expect(result).toBe(42);
    });
  });

  // ─── hasIdsGenerated ─────────────────────────────────────────────────────

  describe('hasIdsGenerated', () => {
    it('retorna false cuando ningún árbol tiene globalId', async () => {
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

    it('retorna true cuando al menos un árbol tiene globalId', async () => {
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
    it('retorna true cuando hay árboles con esa especie en la plantación', async () => {
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

    it('retorna false cuando no hay árboles con esa especie', async () => {
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
