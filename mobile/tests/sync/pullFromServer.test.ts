// Tests for pullFromServer — conflict detection, metadata sync, subgroup upsert

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
  getSyncableSubGroups: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/repositories/TreeRepository', () => ({
  getTreesWithPendingPhotos: jest.fn(),
  markPhotoSynced: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Directory: jest.fn(),
  Paths: { document: 'file://document' },
}));

import { pullFromServer } from '../../src/services/SyncService';
import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;

// Helpers to build chainable mocks
function chainSelect(returnValue: any) {
  return jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(returnValue),
    }),
  });
}

function chainInsert() {
  return jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
    }),
  });
}

function chainUpdate() {
  return jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  });
}

function chainDelete() {
  return jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue(undefined),
  });
}

function defaultSupabaseFrom() {
  (mockSupabase.from as jest.Mock).mockImplementation(() => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  defaultSupabaseFrom();
  (mockDb.select as jest.Mock).mockImplementation(chainSelect([]));
  (mockDb.insert as jest.Mock).mockImplementation(chainInsert());
  (mockDb.update as jest.Mock).mockImplementation(chainUpdate());
  (mockDb.delete as jest.Mock).mockImplementation(chainDelete());
});

// ─── Plantation metadata ─────────────────────────────────────────────────────

describe('pullFromServer — plantation metadata', () => {
  function mockPlantationFromServer(data: any) {
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'plantations') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data, error: null }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
  }

  it('updates lugarServer and periodoServer from server', async () => {
    mockPlantationFromServer({ lugar: 'Zona Norte', periodo: '2026', estado: 'activa' });
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ pendingEdit: false }]),
      }),
    });

    const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    (mockDb.update as jest.Mock).mockReturnValue({ set: setMock });

    await pullFromServer('p-1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ lugarServer: 'Zona Norte', periodoServer: '2026' }),
    );
  });

  it('does NOT overwrite lugar/periodo when pendingEdit is true', async () => {
    mockPlantationFromServer({ lugar: 'Zona Norte', periodo: '2026', estado: 'activa' });
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ pendingEdit: true }]),
      }),
    });

    const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    (mockDb.update as jest.Mock).mockReturnValue({ set: setMock });

    await pullFromServer('p-1');

    const arg = setMock.mock.calls[0][0];
    expect(arg.lugarServer).toBe('Zona Norte');
    expect(arg.periodoServer).toBe('2026');
    expect(arg).not.toHaveProperty('lugar');
    expect(arg).not.toHaveProperty('periodo');
  });

  it('overwrites lugar/periodo when pendingEdit is false', async () => {
    mockPlantationFromServer({ lugar: 'Zona Norte', periodo: '2026', estado: 'activa' });
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ pendingEdit: false }]),
      }),
    });

    const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    (mockDb.update as jest.Mock).mockReturnValue({ set: setMock });

    await pullFromServer('p-1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ lugar: 'Zona Norte', periodo: '2026' }),
    );
  });
});

// ─── Subgroups ───────────────────────────────────────────────────────────────

describe('pullFromServer — subgroups', () => {
  it('upserts remote subgroups into local db', async () => {
    const remoteSubgroups = [
      { id: 'sg-1', plantation_id: 'p-1', nombre: 'A', codigo: 'C1', tipo: 'tipo', estado: 'activa', usuario_creador: 'u1', created_at: '2026-01-01' },
      { id: 'sg-2', plantation_id: 'p-1', nombre: 'B', codigo: 'C2', tipo: 'tipo', estado: 'activa', usuario_creador: 'u1', created_at: '2026-01-01' },
    ];

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'plantations') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }
      if (table === 'subgroups') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: remoteSubgroups, error: null }) }) };
      }
      return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }), in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    await pullFromServer('p-1');

    // insert called once per subgroup
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('preserves local pendingSync flag during upsert (calls onConflictDoUpdate)', async () => {
    const remoteSubgroups = [
      { id: 'sg-1', plantation_id: 'p-1', nombre: 'A', codigo: 'C1', tipo: 'tipo', estado: 'activa', usuario_creador: 'u1', created_at: '2026-01-01' },
    ];

    const onConflictMock = jest.fn().mockResolvedValue(undefined);
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock }),
    });

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'subgroups') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: remoteSubgroups, error: null }) }) };
      }
      if (table === 'plantations') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }
      return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }), in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    await pullFromServer('p-1');

    expect(onConflictMock).toHaveBeenCalled();
  });
});

// ─── Plantation users ────────────────────────────────────────────────────────

describe('pullFromServer — plantation_users', () => {
  it('deletes local users not present on server', async () => {
    const remoteUsers = [{ plantation_id: 'p-1', user_id: 'user-1', rol_en_plantacion: 'admin', assigned_at: '2026-01-01' }];

    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'plantations') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }
      if (table === 'plantation_users') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: remoteUsers, error: null }) }) };
      }
      return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }), in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    // plantation returns null so pendingEdit select is skipped.
    // First db.select call is for local plantation_users.
    (mockDb.select as jest.Mock)
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { plantationId: 'p-1', userId: 'user-1' },
            { plantationId: 'p-1', userId: 'user-2' },
          ]),
        }),
      });

    await pullFromServer('p-1');

    // user-2 should be deleted
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

// ─── Tree conflict detection ─────────────────────────────────────────────────

describe('pullFromServer — tree conflict detection', () => {
  const remoteSubgroups = [{ id: 'sg-1', plantation_id: 'p-1', nombre: 'A', codigo: 'C1', tipo: 'tipo', estado: 'activa', usuario_creador: 'u1', created_at: '2026-01-01' }];
  const remoteTrees = [{ id: 'tree-1', subgroup_id: 'sg-1', species_id: 'sp-server', posicion: 1, sub_id: 'A1', foto_url: null, usuario_registro: 'u1', created_at: '2026-01-01' }];

  function setupTreeTest() {
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'plantations') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }
      if (table === 'subgroups') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: remoteSubgroups, error: null }) }) };
      }
      if (table === 'trees') {
        return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: remoteTrees, error: null }) }) };
      }
      return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }), in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
    });
  }

  it('sets conflictEspecieId when local species differs from server', async () => {
    setupTreeTest();

    const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    (mockDb.update as jest.Mock).mockReturnValue({ set: setMock });

    // plantation returns null so pendingEdit select is skipped.
    // Calls: 1) local plantation_users, 2) local tree, 3) species name
    (mockDb.select as jest.Mock)
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) })
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ especieId: 'sp-local' }]) }) })
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ nombre: 'Pino' }]) }) });

    await pullFromServer('p-1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ conflictEspecieId: 'sp-server', conflictEspecieNombre: 'Pino' }),
    );
  });

  it('skips tree upsert when conflict is detected', async () => {
    setupTreeTest();

    const insertValuesMock = jest.fn().mockReturnValue({ onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) });
    (mockDb.insert as jest.Mock).mockReturnValue({ values: insertValuesMock });

    // plantation returns null so pendingEdit select is skipped.
    // Calls: 1) local plantation_users, 2) local tree, 3) species name
    (mockDb.select as jest.Mock)
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) })
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ especieId: 'sp-local' }]) }) })
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ nombre: 'Pino' }]) }) });

    await pullFromServer('p-1');

    // db.insert is called for subgroup upsert but NOT for tree upsert
    // subgroup insert = 1 call; tree insert should be skipped due to conflict
    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    // All insert calls should be for subgroups only (1 subgroup), not trees
    expect(insertCalls.length).toBe(1);
  });

  it('does NOT detect conflict when local especieId is null', async () => {
    setupTreeTest();

    const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    (mockDb.update as jest.Mock).mockReturnValue({ set: setMock });

    // plantation returns null so pendingEdit select is skipped.
    // Calls: 1) local plantation_users, 2) local tree
    (mockDb.select as jest.Mock)
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) })
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ especieId: null }]) }) });

    await pullFromServer('p-1');

    // No conflict update should have been called with conflictEspecieId
    for (const call of setMock.mock.calls) {
      expect(call[0]).not.toHaveProperty('conflictEspecieId');
    }

    // Tree insert SHOULD have been called (normal upsert path)
    // 1 for subgroup + 1 for tree = 2
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});
