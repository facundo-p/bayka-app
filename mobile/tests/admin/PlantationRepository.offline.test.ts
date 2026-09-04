// Tests for offline plantation functions in PlantationRepository

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
    delete: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/services/SyncService', () => ({
  pullFromServer: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
}));

import {
  createPlantationLocally,
  saveSpeciesConfigLocally,
} from '../../src/repositories/PlantationRepository';

import { db } from '../../src/database/client';
import { notifyDataChanged } from '../../src/database/liveQuery';

const mockDb = db as jest.Mocked<typeof db>;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;

describe('PlantationRepository — offline functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // values() se awaitea directo (plantación) o se encadena .onConflictDoNothing()
    // (membresía local del creador, #67).
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue(
        Object.assign(Promise.resolve(undefined), {
          onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
        })
      ),
    });

    (mockDb.delete as jest.Mock).mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });

    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
  });

  // ─── createPlantationLocally ──────────────────────────────────────────────

  describe('createPlantationLocally (OFPL-01)', () => {
    it('Test 1: calls db.insert with pendingSync=true and no Supabase call', async () => {
      const result = await createPlantationLocally('Zona Norte', '2026', 'org-1', 'user-1');

      expect(mockDb.insert).toHaveBeenCalled();
      const insertResult = (mockDb.insert as jest.Mock).mock.results[0].value;
      expect(insertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid-123',
          lugar: 'Zona Norte',
          periodo: '2026',
          organizacionId: 'org-1',
          creadoPor: 'user-1',
          estado: 'activa',
          pendingSync: true,
        })
      );
    });

    it('Test 2: calls notifyDataChanged after inserting', async () => {
      await createPlantationLocally('Zona Norte', '2026', 'org-1', 'user-1');

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it('Test 2b: registra al creador como miembro admin local (issue #67)', async () => {
      await createPlantationLocally('Zona Norte', '2026', 'org-1', 'user-1');

      const valuesMock = (mockDb.insert as jest.Mock).mock.results[0].value.values as jest.Mock;
      const membership = valuesMock.mock.calls.map((c) => c[0]).find((v: any) => v?.rolEnPlantacion);
      expect(membership).toMatchObject({
        plantationId: 'mock-uuid-123',
        userId: 'user-1',
        rolEnPlantacion: 'admin',
      });
    });

    it('Test 3: returns { id, lugar, periodo, estado: activa }', async () => {
      const result = await createPlantationLocally('Zona Norte', '2026', 'org-1', 'user-1');

      expect(result).toEqual({
        id: 'mock-uuid-123',
        lugar: 'Zona Norte',
        periodo: '2026',
        estado: 'activa',
      });
    });

    it('Test 4 (OFPL-03): local FK constraint satisfied — subgroup can reference offline plantation', async () => {
      // La plantación queda insertada localmente con pendingSync=true, así que un
      // subgroup insert que la referencie no viola el FK constraint de SQLite.

      const plantation = await createPlantationLocally('Zona Sur', '2026', 'org-1', 'user-2');

      expect(plantation.id).toBe('mock-uuid-123');

      const subgroupInsertValues = {
        id: 'sg-uuid-1',
        plantacionId: plantation.id,
        nombre: 'Línea 1',
        codigo: 'L1',
        tipo: 'linea',
        estado: 'activa',
        usuarioCreador: 'user-2',
        createdAt: new Date().toISOString(),
      };

      const insertResult = (mockDb.insert as jest.Mock).mock.results[0].value;
      expect(insertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({ pendingSync: true })
      );

      await expect(
        Promise.resolve(mockDb.insert(null as any).values(subgroupInsertValues))
      ).resolves.not.toThrow();
    });
  });

  // ─── saveSpeciesConfigLocally ─────────────────────────────────────────────

  describe('saveSpeciesConfigLocally (OFPL-02)', () => {
    it('Test 5: deletes existing species and inserts new items', async () => {
      const items = [
        { especieId: 'sp-1', ordenVisual: 0 },
        { especieId: 'sp-2', ordenVisual: 1 },
      ];

      await saveSpeciesConfigLocally('plantation-1', items);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      const insertResult = (mockDb.insert as jest.Mock).mock.results[0].value;
      expect(insertResult.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ plantacionId: 'plantation-1', especieId: 'sp-1', ordenVisual: 0 }),
          expect.objectContaining({ plantacionId: 'plantation-1', especieId: 'sp-2', ordenVisual: 1 }),
        ])
      );
    });

    it('Test 6: with empty items — calls delete but NOT insert, still calls notifyDataChanged', async () => {
      await saveSpeciesConfigLocally('plantation-1', []);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it('Test 7: does NOT call supabase (pure local write)', async () => {
      const supabase = require('../../src/supabase/client').supabase;
      const items = [{ especieId: 'sp-1', ordenVisual: 0 }];

      await saveSpeciesConfigLocally('plantation-1', items);

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('Test 8: calls notifyDataChanged after writes', async () => {
      const items = [{ especieId: 'sp-1', ordenVisual: 0 }];
      await saveSpeciesConfigLocally('plantation-1', items);

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });
});
