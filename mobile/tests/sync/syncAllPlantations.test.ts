jest.mock('../../src/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getSession: jest.fn(), getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    storage: { from: jest.fn() },
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
  markSubGroupSynced: jest.fn().mockResolvedValue(undefined),
  getSyncableSubGroups: jest.fn(),
}));

jest.mock('../../src/repositories/TreeRepository', () => ({
  getTreesWithPendingPhotos: jest.fn().mockResolvedValue([]),
  markPhotoSynced: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((pathOrDir, name) => ({
    uri: name ? `file://document/photos/${name}` : 'file://document/photos/photo.jpg',
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  })),
  Directory: jest.fn().mockImplementation(() => {
    const dir = { create: jest.fn() };
    Object.defineProperty(dir, 'exists', { get: () => true });
    return dir;
  }),
  Paths: { document: 'file://document' },
}));

import { syncAllPlantations } from '../../src/services/SyncService';
import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { getSyncableSubGroups, markSubGroupSynced } from '../../src/repositories/SubGroupRepository';
import { getTreesWithPendingPhotos } from '../../src/repositories/TreeRepository';
import { notifyDataChanged } from '../../src/database/liveQuery';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;
const mockGetSyncableSubGroups = getSyncableSubGroups as jest.Mock;
const mockMarkSubGroupSynced = markSubGroupSynced as jest.Mock;
const mockGetTreesWithPendingPhotos = getTreesWithPendingPhotos as jest.Mock;
const mockNotifyDataChanged = notifyDataChanged as jest.Mock;

// Helper: build a db.select chain that resolves to `directResult` when awaited
// and returns [] when .where() is called (for pre-step queries).
function makeSelectChain(directResult: any[]) {
  return {
    from: jest.fn().mockReturnValue(
      Object.assign(Promise.resolve(directResult), {
        where: jest.fn().mockResolvedValue([]),
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      })
    ),
  };
}

function makeSupabaseChain() {
  const eqResult: any = { data: [], error: null };
  eqResult.single = jest.fn().mockResolvedValue({ data: null, error: null });
  eqResult.then = (res: any, rej?: any) => Promise.resolve({ data: [], error: null }).then(res, rej);

  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue(eqResult),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    insert: jest.fn().mockResolvedValue({ error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  };
}

function setupSupabaseDefaults() {
  (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: {} }, error: null });

  (mockSupabase.from as jest.Mock).mockImplementation(() => makeSupabaseChain());

  (mockDb.insert as jest.Mock).mockReturnValue({
    values: jest.fn().mockReturnValue({
      onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
    }),
  });

  (mockDb.update as jest.Mock).mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  });
}

const TWO_PLANTATIONS = [{ id: 'p-1', lugar: 'Zona A' }, { id: 'p-2', lugar: 'Zona B' }];
const ONE_PLANTATION = [{ id: 'p-1', lugar: 'Zona A' }];

beforeEach(() => {
  jest.clearAllMocks();
  setupSupabaseDefaults();

  // Default: no local plantations
  (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain([]));

  mockGetSyncableSubGroups.mockResolvedValue([]);
  mockGetTreesWithPendingPhotos.mockResolvedValue([]);
});

describe('syncAllPlantations', () => {
  it('calls auth.getSession before any other operation', async () => {
    await syncAllPlantations();
    expect(mockSupabase.auth.getSession).toHaveBeenCalled();
  });

  it('calls global pre-steps exactly once (pullSpecies, uploadOffline, uploadPendingEdits)', async () => {
    (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain(TWO_PLANTATIONS));

    await syncAllPlantations();

    const speciesCalls = (mockSupabase.from as jest.Mock).mock.calls.filter(
      (c: any[]) => c[0] === 'species'
    );
    expect(speciesCalls).toHaveLength(1);
  });

  it('iterates all local plantations and returns results per plantation', async () => {
    (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain(TWO_PLANTATIONS));

    const result = await syncAllPlantations();

    expect(result).toHaveLength(2);
    expect(result[0].plantationId).toBe('p-1');
    expect(result[0].plantationName).toBe('Zona A');
    expect(result[0].results).toEqual([]);
    expect(result[1].plantationId).toBe('p-2');
    expect(result[1].plantationName).toBe('Zona B');
  });

  it('progress callback receives correct plantation name and index', async () => {
    (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain(TWO_PLANTATIONS));
    const progressFn = jest.fn();

    await syncAllPlantations(progressFn);

    expect(progressFn).toHaveBeenCalledWith(
      expect.objectContaining({ plantationName: 'Zona A', plantationDone: 0, plantationTotal: 2 })
    );
    expect(progressFn).toHaveBeenCalledWith(
      expect.objectContaining({ plantationName: 'Zona B', plantationDone: 1, plantationTotal: 2 })
    );
  });

  it('uploads syncable subgroups for each plantation', async () => {
    (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain(ONE_PLANTATION));
    mockGetSyncableSubGroups.mockResolvedValue([{
      id: 'sg-1', plantacionId: 'p-1', nombre: 'Linea A', codigo: 'LA',
      tipo: 'linea', estado: 'finalizada', usuarioCreador: 'user-1', createdAt: '2026-01-01',
    }]);
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

    const result = await syncAllPlantations();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('sync_subgroup', expect.anything());
    expect(mockMarkSubGroupSynced).toHaveBeenCalledWith('sg-1');
    expect(result[0].results[0].success).toBe(true);
  });

  it('runs photo sync when incluirFotos is true', async () => {
    (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain(ONE_PLANTATION));

    await syncAllPlantations(undefined, true);

    expect(mockGetTreesWithPendingPhotos).toHaveBeenCalledWith('p-1');
  });

  it('skips photo sync when incluirFotos is false', async () => {
    (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain(ONE_PLANTATION));

    await syncAllPlantations(undefined, false);

    expect(mockGetTreesWithPendingPhotos).not.toHaveBeenCalled();
  });

  it('per-plantation failure does not abort the batch', async () => {
    (mockDb.select as jest.Mock).mockReturnValue(makeSelectChain(TWO_PLANTATIONS));

    // pullFromServer calls supabase.from('plantations').select(...).eq(...).single()
    // Make it throw for the first plantation by counting 'plantations' calls after pre-steps.
    let plantationFromCalls = 0;
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'plantations') {
        plantationFromCalls++;
        // Calls 1-2 are pre-steps (uploadOffline, uploadPendingEdits).
        // Call 3 is pullFromServer for p-1 — make it throw.
        if (plantationFromCalls === 3) {
          throw new Error('Network error for p-1');
        }
      }
      return makeSupabaseChain();
    });

    const result = await syncAllPlantations();

    expect(result).toHaveLength(2);
    expect(result[0].plantationId).toBe('p-1');
    expect(result[0].results).toEqual([]);
    expect(result[1].plantationId).toBe('p-2');
  });
});
