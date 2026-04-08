// Tests for offline sync functions in SyncService
// Covers: OFPL-04, OFPL-05, OFPL-06

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn(), getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    rpc: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/repositories/SubGroupRepository', () => ({
  markAsSincronizada: jest.fn(),
  getSyncableSubGroups: jest.fn().mockResolvedValue([]),
}));

import {
  pullSpeciesFromServer,
  uploadOfflinePlantations,
} from '../../src/services/SyncService';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;

const fakeSpecies = [
  { id: 'sp-1', codigo: 'QRC', nombre: 'Quercus robur', nombre_cientifico: 'Quercus robur', created_at: '2026-01-01T00:00:00Z' },
  { id: 'sp-2', codigo: 'PIN', nombre: 'Pino', nombre_cientifico: null, created_at: '2026-01-01T00:00:00Z' },
];

const fakePendingPlantation = {
  id: 'plantation-offline-1',
  organizacionId: 'org-1',
  lugar: 'Zona Offline',
  periodo: '2026',
  estado: 'activa',
  creadoPor: 'user-1',
  createdAt: '2026-04-01T00:00:00Z',
  pendingSync: true,
};

const fakePlantationSpecies = [
  { id: 'ps-plantation-offline-1-sp-1', plantacionId: 'plantation-offline-1', especieId: 'sp-1', ordenVisual: 0 },
];

describe('SyncService — offline functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default db.insert chain with onConflictDoUpdate support
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default db.select chain
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    // Default db.update chain
    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default supabase.from chain
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  // ─── pullSpeciesFromServer ─────────────────────────────────────────────────

  describe('pullSpeciesFromServer (OFPL-04)', () => {
    it('Test 1: calls supabase.from("species").select("*") and upserts each species into local db', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: fakeSpecies, error: null }),
      });

      await pullSpeciesFromServer();

      expect(mockSupabase.from).toHaveBeenCalledWith('species');
      const fromResult = (mockSupabase.from as jest.Mock).mock.results[0].value;
      expect(fromResult.select).toHaveBeenCalledWith('*');

      // db.insert called twice (once per species)
      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      // Verify first species upsert
      const firstInsert = (mockDb.insert as jest.Mock).mock.results[0].value;
      expect(firstInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sp-1', codigo: 'QRC', nombre: 'Quercus robur' })
      );
      const firstValues = firstInsert.values.mock.results[0].value;
      expect(firstValues.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('Test 2: does NOT call db.insert if supabase returns an error', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
      });

      await pullSpeciesFromServer();

      // No db.insert calls — non-blocking behavior
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Test 3: does NOT call db.delete — only upserts (preserves existing species)', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: fakeSpecies, error: null }),
      });

      await pullSpeciesFromServer();

      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  // ─── uploadOfflinePlantations ──────────────────────────────────────────────

  describe('uploadOfflinePlantations (OFPL-05, OFPL-06)', () => {
    it('Test 4: happy path — queries pending plantations, inserts to server, upserts species, marks pendingSync=false', async () => {
      // Return pending plantation from local db
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });

      // Return plantation_species from local db
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(fakePlantationSpecies),
        }),
      });

      // supabase.from('plantations').insert() -> success
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'plantation_species') {
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      await uploadOfflinePlantations();

      // Verify plantation was inserted to server
      const plantationFromCalls = (mockSupabase.from as jest.Mock).mock.calls;
      expect(plantationFromCalls.some(([t]) => t === 'plantations')).toBe(true);
      expect(plantationFromCalls.some(([t]) => t === 'plantation_species')).toBe(true);

      // Verify pendingSync=false was set
      expect(mockDb.update).toHaveBeenCalled();
      const updateResult = (mockDb.update as jest.Mock).mock.results[0].value;
      expect(updateResult.set).toHaveBeenCalledWith({ pendingSync: false });
    });

    it('Test 5: 23505 (duplicate key) — proceeds with species upload AND marks pendingSync=false', async () => {
      // Return pending plantation
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });

      // Return plantation_species
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(fakePlantationSpecies),
        }),
      });

      const speciesUpsertMock = jest.fn().mockResolvedValue({ error: null });

      // supabase.from returns 23505 error for plantation insert, but upsert for species
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            insert: jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } }),
          };
        }
        if (table === 'plantation_species') {
          return { upsert: speciesUpsertMock };
        }
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });

      await uploadOfflinePlantations();

      // Species upsert MUST still be called (23505 = idempotent re-upload)
      expect(speciesUpsertMock).toHaveBeenCalled();

      // pendingSync MUST be set to false
      expect(mockDb.update).toHaveBeenCalled();
      const updateResult = (mockDb.update as jest.Mock).mock.results[0].value;
      expect(updateResult.set).toHaveBeenCalledWith({ pendingSync: false });
    });

    it('Test 6: non-23505 error — species upload is NOT called and pendingSync remains true (plantation skipped)', async () => {
      // Return pending plantation
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakePendingPlantation]),
        }),
      });

      const speciesUpsertMock = jest.fn();

      // supabase.from returns a non-23505 error for plantation insert
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            insert: jest.fn().mockResolvedValue({ error: { code: '42P01', message: 'table not found' } }),
          };
        }
        if (table === 'plantation_species') {
          return { upsert: speciesUpsertMock };
        }
        return { select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });

      await uploadOfflinePlantations();

      // Species upsert must NOT be called (plantation upload failed with non-idempotent error)
      expect(speciesUpsertMock).not.toHaveBeenCalled();

      // pendingSync must NOT be updated to false (plantation was skipped)
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('Test 7: no pending plantations — no server calls made', async () => {
      // Return empty list — no pending plantations
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await uploadOfflinePlantations();

      // No supabase calls for plantations or species
      const fromCalls = (mockSupabase.from as jest.Mock).mock.calls;
      expect(fromCalls.some(([t]) => t === 'plantations')).toBe(false);
      expect(fromCalls.some(([t]) => t === 'plantation_species')).toBe(false);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
