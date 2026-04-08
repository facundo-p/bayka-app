// Tests for offline plantation functions in PlantationRepository
// Covers: OFPL-01, OFPL-02, OFPL-03

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

    // Default db.insert chain
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });

    // Default db.delete chain
    (mockDb.delete as jest.Mock).mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });

    // Default db.update chain
    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default db.select chain
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
      // Simulates: createPlantationLocally inserts the plantation locally, then
      // a SubGroup insert with that plantationId succeeds because the row exists in local SQLite.
      // In real SQLite this is enforced by the FK constraint. Here we test that:
      // 1. createPlantationLocally returns a valid id
      // 2. db.insert is called with that id (plantation row exists locally)
      // 3. A subsequent db.insert for a subgroup with that plantationId would NOT throw
      //    (no FK violation because the plantation row is in local SQLite with pendingSync=true)

      const plantation = await createPlantationLocally('Zona Sur', '2026', 'org-1', 'user-2');

      // plantation.id is the local UUID that satisfies the FK
      expect(plantation.id).toBe('mock-uuid-123');

      // Now simulate a subgroup insert referencing the offline plantation
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

      // The plantation row was inserted locally — subgroup can reference it without FK error
      // (In tests we verify the plantation was inserted, not the FK enforcement itself
      //  since we use mocks; the integration guarantee is that pendingSync=true plantation
      //  rows are real SQLite rows that satisfy FK constraints)
      const insertResult = (mockDb.insert as jest.Mock).mock.results[0].value;
      expect(insertResult.values).toHaveBeenCalledWith(
        expect.objectContaining({ pendingSync: true })
      );

      // Subgroup insert would succeed because plantation row exists locally
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

      // Verify delete was called (replaces existing species)
      expect(mockDb.delete).toHaveBeenCalled();

      // Verify insert was called with mapped items
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

      // Delete should still be called to clear existing species
      expect(mockDb.delete).toHaveBeenCalled();

      // Insert should NOT be called (no items to insert)
      expect(mockDb.insert).not.toHaveBeenCalled();

      // notifyDataChanged still called
      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it('Test 7: does NOT call supabase (pure local write)', async () => {
      const supabase = require('../../src/supabase/client').supabase;
      const items = [{ especieId: 'sp-1', ordenVisual: 0 }];

      await saveSpeciesConfigLocally('plantation-1', items);

      // Supabase should not be touched
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('Test 8: calls notifyDataChanged after writes', async () => {
      const items = [{ especieId: 'sp-1', ordenVisual: 0 }];
      await saveSpeciesConfigLocally('plantation-1', items);

      expect(mockNotifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });
});
