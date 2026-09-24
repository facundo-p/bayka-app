// Tests for adminQueries — admin read queries for plantation management

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

jest.mock('../../src/queries/catalogQueries', () => ({
  getResumenDePendientes: jest.fn(),
}));

import {
  checkFinalizationGate,
  getPlantationEstadoDeEdicion,
  getAllTechnicians,
  getPlantationSpeciesConfig,
  getAssignedTechnicians,
  hasTreesForSpecies,
  hasIdsGenerated,
  porAsignadoYNombre,
} from '../../src/queries/adminQueries';

import { db } from '../../src/database/client';
import { supabase } from '../../src/supabase/client';
import { getResumenDePendientes } from '../../src/queries/catalogQueries';

const SIN_PENDIENTES = { activaCount: 0, finalizadaCount: 0, parcelas: 0, fotos: 0, borrados: 0 };

const mockDb = db as jest.Mocked<typeof db>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

/**
 * Helper: sets up mockDb.select to return different results on sequential calls.
 * Call 1: groups query (used by checkFinalizationGate)
 * Call 2: N/N trees query (used by checkFinalizationGate for unresolvedNNCount)
 */
function setupFinalizationMocks(groups: any[], nnRows: any[] = []) {
  let callCount = 0;
  (mockDb.select as jest.Mock).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // Groups query
      return {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(groups),
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
    beforeEach(() => {
      (getResumenDePendientes as jest.Mock).mockResolvedValue(SIN_PENDIENTES);
    });

    it.each([
      ['fotos sin subir', { fotos: 2 }],
      ['parcelas pendientes', { parcelas: 1 }],
      ['borrados pendientes', { borrados: 3 }],
    ])('canFinalize=false con %s aunque los grupos estén listos (#537)', async (_caso, pendiente) => {
      const pendientes = { ...SIN_PENDIENTES, ...pendiente };
      (getResumenDePendientes as jest.Mock).mockResolvedValue(pendientes);
      setupFinalizationMocks([{ nombre: 'Línea A', estado: 'sincronizada', pendingSync: false }], []);

      const result = await checkFinalizationGate('plantation-1');

      expect(getResumenDePendientes).toHaveBeenCalledWith('plantation-1');
      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toEqual([]);
      expect(result.pendientes).toEqual(pendientes);
    });
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
      expect(result.hasGroups).toBe(true);
      expect(result.unresolvedNNCount).toBe(0);
      expect(result.unresolvedNNGroups).toBe(0);
    });

    it('canFinalize=true cuando todos los subgrupos están sincronizada + pendingSync=false', async () => {
      // sincronizada is a valid "done" state for finalization (groups move
      // finalizada → sincronizada after sync).
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
      expect(result.hasGroups).toBe(false);
    });

    it('canFinalize=false cuando hay N/N sin resolver', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'finalizada', pendingSync: false },
        ],
        [
          { grupoId: 'sg-1', cnt: 3 }, // 3 unresolved N/N trees
        ]
      );

      const result = await checkFinalizationGate('plantation-1');

      expect(result.canFinalize).toBe(false);
      expect(result.blocking).toEqual([]); // groups are fine
      expect(result.unresolvedNNCount).toBe(3);
      expect(result.unresolvedNNGroups).toBe(1);
    });

    it('canFinalize=false con mezcla de blocking + N/N sin resolver', async () => {
      setupFinalizationMocks(
        [
          { nombre: 'Línea A', estado: 'activa', pendingSync: false },
          { nombre: 'Línea B', estado: 'sincronizada', pendingSync: false },
        ],
        [
          { grupoId: 'sg-b', cnt: 2 },
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

  // ─── hasIdsGenerated ─────────────────────────────────────────────────────

  describe('getPlantationEstadoDeEdicion', () => {
    const mockRows = (rows: any[]) => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(rows) }),
      });
    };

    it('trae estado y archivadaEn: los dos deciden si es editable (#477)', async () => {
      mockRows([{ estado: 'finalizada', archivadaEn: '2026-09-17T12:00:00+00:00' }]);
      expect(await getPlantationEstadoDeEdicion('plantation-1'))
        .toEqual({ estado: 'finalizada', archivadaEn: '2026-09-17T12:00:00+00:00' });
    });

    it('null si la plantación no está local', async () => {
      mockRows([]);
      expect(await getPlantationEstadoDeEdicion('plantation-1')).toBeNull();
    });
  });

  describe('hasIdsGenerated', () => {
    const mockCounts = (total: number, conId: number) => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ total, conId }]),
          }),
        }),
      });
    };

    it('retorna false cuando ningún árbol tiene globalId', async () => {
      mockCounts(5, 0);
      expect(await hasIdsGenerated('plantation-1')).toBe(false);
    });

    it('retorna true solo cuando TODOS los árboles tienen globalId', async () => {
      mockCounts(5, 5);
      expect(await hasIdsGenerated('plantation-1')).toBe(true);
    });

    it('retorna false con un set PARCIAL de IDs (remanente de sync incompleto)', async () => {
      // Regresión: 401/7124 árboles con globalId NO cuenta como "generado".
      // El gate "al menos uno" ocultaba "Generar IDs" dejando el 94% sin ID.
      mockCounts(7124, 401);
      expect(await hasIdsGenerated('plantation-1')).toBe(false);
    });

    it('retorna false cuando la plantación no tiene árboles', async () => {
      mockCounts(0, 0);
      expect(await hasIdsGenerated('plantation-1')).toBe(false);
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

// `getTechniciansWithAssignment` cruza las dos lecturas que antes hacía el hook
// a mano: el catálogo de Supabase y la asignación del SQLite local (#546).
describe('porAsignadoYNombre', () => {
  it('pone primero a los asignados y ordena el resto por nombre', () => {
    const tecnicos = [
      { id: '1', nombre: 'Zoe', assigned: false },
      { id: '2', nombre: 'Bruno', assigned: true },
      { id: '3', nombre: 'Ana', assigned: false },
      { id: '4', nombre: 'Ada', assigned: true },
    ];

    expect([...tecnicos].sort(porAsignadoYNombre).map((t) => t.nombre)).toEqual([
      'Ada',
      'Bruno',
      'Ana',
      'Zoe',
    ]);
  });
});
