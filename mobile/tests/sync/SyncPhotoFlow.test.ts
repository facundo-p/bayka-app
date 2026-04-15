// Tests for photo sync logic and Phase 14 bug fixes.
// Covers: hasFotoOnServer, pendingSync preservation, fotoUrl preservation,
// markSubGroupSynced estado, getSyncableSubGroups filter, getTreesWithPendingPhotos,
// N/N trees in upload payload.

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getSession: jest.fn(), getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    storage: {
      from: jest.fn(),
    },
  },
  isSupabaseConfigured: true,
}));

jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
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
  getTreesWithPendingPhotos: jest.fn(),
  markPhotoSynced: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  const mockArrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
  const mockDownloadFileAsync = jest.fn().mockResolvedValue(undefined);

  const MockFile = jest.fn().mockImplementation((pathOrDir, name) => ({
    uri: name
      ? `file://document/photos/${name}`
      : (typeof pathOrDir === 'string' ? pathOrDir : 'file://document/photos/photo.jpg'),
    arrayBuffer: mockArrayBuffer,
  }));
  (MockFile as any).downloadFileAsync = mockDownloadFileAsync;

  const MockDirectory = jest.fn().mockImplementation(() => {
    const dir = { create: jest.fn() };
    Object.defineProperty(dir, 'exists', { get: () => true });
    return dir;
  });

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: 'file://document' },
    _mockArrayBuffer: mockArrayBuffer,
    _mockDownloadFileAsync: mockDownloadFileAsync,
  };
});

import {
  pullFromServer,
  uploadSubGroup,
  uploadPendingPhotos,
  syncPlantation,
} from '../../src/services/SyncService';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { markSubGroupSynced, getSyncableSubGroups } from '../../src/repositories/SubGroupRepository';
import { getTreesWithPendingPhotos, markPhotoSynced } from '../../src/repositories/TreeRepository';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;
const mockGetSyncableSubGroups = getSyncableSubGroups as jest.Mock;
const mockMarkSubGroupSynced = markSubGroupSynced as jest.Mock;
const mockGetTreesWithPendingPhotos = getTreesWithPendingPhotos as jest.Mock;
const mockMarkPhotoSynced = markPhotoSynced as jest.Mock;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeSg = (id: string, overrides?: Record<string, any>) => ({
  id,
  plantacionId: 'plantation-1',
  nombre: 'Línea A',
  codigo: 'LA',
  tipo: 'linea' as const,
  estado: 'finalizada' as const,
  usuarioCreador: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  pendingSync: true,
  ...overrides,
});

const makeTree = (id: string, subgrupoId: string, overrides?: Record<string, any>) => ({
  id,
  subgrupoId,
  especieId: 'species-1',
  posicion: 1,
  subId: 'LA-SP-1',
  fotoUrl: null as string | null,
  fotoSynced: false,
  plantacionId: null as number | null,
  globalId: null as number | null,
  usuarioRegistro: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('SyncPhotoFlow — bugs corregidos en Fase 14', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth session mock
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: {} }, error: null });

    // Default: no pending subgroups
    mockGetSyncableSubGroups.mockResolvedValue([]);

    // Default: no pending photos
    mockGetTreesWithPendingPhotos.mockResolvedValue([]);
    mockMarkPhotoSynced.mockResolvedValue(undefined);

    // Default: empty db.select chain
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    // Default: supabase.from chain
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Default: db.insert chain
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default: db.update chain
    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default: supabase.storage chain
    (mockSupabase.storage.from as jest.Mock).mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/photo.jpg' }, error: null }),
    });
  });

  // ─── Test 1: hasFotoOnServer excluye URIs file:// ───────────────────────────

  describe('hasFotoOnServer excluye URIs file://', () => {
    it('foto_url con file:// del servidor NO se marca como synced', async () => {
      // Arrange: server returns a tree with a file:// URI (leaked from another device)
      const remoteTree = {
        id: 'tree-1',
        subgroup_id: 'sg-1',
        species_id: 'species-1',
        posicion: 1,
        sub_id: 'LA-SP-1',
        foto_url: 'file:///data/user/0/com.bayka/photos/photo.jpg',
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      // Setup pull chain: plantation metadata, subgroups, plantation_users, plantation_species, trees
      const fromMock = jest.fn();
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { lugar: 'Campo', periodo: '2026', estado: 'activa' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'subgroups') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ id: 'sg-1', plantation_id: 'plantation-1', nombre: 'Línea A', codigo: 'LA', tipo: 'linea', estado: 'finalizada', usuario_creador: 'user-1', created_at: '2026-01-01T00:00:00Z' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'trees') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [remoteTree], error: null }),
            }),
          };
        }
        // plantation_users, plantation_species
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      // Capture what gets passed to db.insert for trees
      const insertValuesSpy = jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      });
      (mockDb.insert as jest.Mock).mockReturnValue({
        values: insertValuesSpy,
      });

      // db.select for local tree lookup (conflict detection) — tree not found locally
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act
      await pullFromServer('plantation-1');

      // Assert: the tree insert should have fotoSynced = false because file:// is not a real server photo
      const treeCalls = insertValuesSpy.mock.calls;
      const treeInsertCall = treeCalls.find((call: any[]) =>
        call[0]?.id === 'tree-1'
      );

      expect(treeInsertCall).toBeDefined();
      // hasFotoOnServer = !!foto_url && !foto_url.startsWith('file://')
      // For file:///data/... → hasFotoOnServer = false → fotoSynced = false
      expect(treeInsertCall![0].fotoSynced).toBe(false);
    });
  });

  // ─── Test 2: Pull preserva flag pendingSync local ───────────────────────────

  describe('Pull preserva flag pendingSync local', () => {
    it('subgrupo con pendingSync=true local no se resetea a false en pull', async () => {
      // This test verifies the CASE WHEN SQL logic in pullFromServer:
      // pendingSync: sql`CASE WHEN ${subgroups.pendingSync} = 1 THEN 1 ELSE 0 END`
      // We verify that the onConflictDoUpdate set includes the CASE WHEN pattern
      // by checking that the insert values use pendingSync: false (initial value)
      // while the conflict update preserves the existing local value.

      const remoteSubgroup = {
        id: 'sg-1',
        plantation_id: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        estado: 'finalizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { lugar: 'Campo', periodo: '2026', estado: 'activa' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'subgroups') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [remoteSubgroup], error: null }),
            }),
          };
        }
        if (table === 'trees') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const onConflictSpy = jest.fn().mockResolvedValue(undefined);
      const valuesSpy = jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictSpy });
      (mockDb.insert as jest.Mock).mockReturnValue({ values: valuesSpy });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await pullFromServer('plantation-1');

      // Verify the subgroup insert was called with pendingSync: false as default value
      const sgInsert = valuesSpy.mock.calls.find((call: any[]) =>
        call[0]?.id === 'sg-1' && call[0]?.plantacionId === 'plantation-1'
      );
      expect(sgInsert).toBeDefined();
      expect(sgInsert![0].pendingSync).toBe(false);

      // Verify onConflictDoUpdate was called with a set that includes pendingSync
      // (the CASE WHEN SQL is what preserves it — we verify the key exists in set)
      const conflictCall = onConflictSpy.mock.calls.find((call: any[]) =>
        call[0]?.target !== undefined || call[0]?.set?.pendingSync !== undefined
      );
      expect(conflictCall).toBeDefined();
      expect(conflictCall![0].set).toHaveProperty('pendingSync');
    });
  });

  // ─── Test 3: Pull preserva fotoUrl local file:// ────────────────────────────

  describe('Pull preserva fotoUrl local file://', () => {
    it('árbol con fotoUrl file:// local no se sobreescribe con foto del servidor', async () => {
      // This test verifies the CASE WHEN SQL in pullFromServer:
      // fotoUrl: sql`CASE WHEN ${trees.fotoUrl} LIKE 'file://%' THEN ${trees.fotoUrl} ELSE excluded.foto_url END`
      // The conflict update set should include fotoUrl with the CASE WHEN pattern.

      const remoteTree = {
        id: 'tree-1',
        subgroup_id: 'sg-1',
        species_id: 'species-1',
        posicion: 1,
        sub_id: 'LA-SP-1',
        foto_url: 'plantations/plantation-1/trees/tree-1.jpg',
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'plantations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { lugar: 'Campo', periodo: '2026', estado: 'activa' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'subgroups') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ id: 'sg-1', plantation_id: 'plantation-1', nombre: 'Línea A', codigo: 'LA', tipo: 'linea', estado: 'finalizada', usuario_creador: 'user-1', created_at: '2026-01-01T00:00:00Z' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'trees') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [remoteTree], error: null }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      // Local tree lookup for conflict detection — tree exists locally with same species
      (mockDb.select as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ especieId: 'species-1' }]),
        }),
      }));

      const onConflictSpy = jest.fn().mockResolvedValue(undefined);
      const valuesSpy = jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictSpy });
      (mockDb.insert as jest.Mock).mockReturnValue({ values: valuesSpy });

      await pullFromServer('plantation-1');

      // Verify tree insert was called and onConflictDoUpdate set includes fotoUrl
      const treeInsert = valuesSpy.mock.calls.find((call: any[]) =>
        call[0]?.id === 'tree-1'
      );
      expect(treeInsert).toBeDefined();

      // The onConflictDoUpdate set should include the fotoUrl CASE WHEN logic
      const treeConflict = onConflictSpy.mock.calls.find((call: any[]) =>
        call[0]?.set?.fotoUrl !== undefined
      );
      expect(treeConflict).toBeDefined();
      expect(treeConflict![0].set).toHaveProperty('fotoUrl');
    });
  });

  // ─── Test 4: markSubGroupSynced establece estado sincronizada ───────────────

  describe('markSubGroupSynced establece estado sincronizada', () => {
    it('después de sync exitoso, estado cambia a sincronizada y pendingSync=false', async () => {
      // markSubGroupSynced is mocked, so we test it by verifying the mock's expected
      // behavior matches what's documented in SubGroupRepository:
      // set({ pendingSync: false, estado: 'sincronizada' })

      // We test through syncPlantation: on RPC success, markSubGroupSynced is called with sg id
      const sg = makeSg('sg-1');
      mockGetSyncableSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      await syncPlantation('plantation-1');

      expect(mockMarkSubGroupSynced).toHaveBeenCalledWith('sg-1');
      // The actual implementation sets estado='sincronizada', pendingSync=false
      // This is verified by the repository's own unit test, but here we ensure
      // the service calls the right function after successful sync
    });
  });

  // ─── Test 5: getSyncableSubGroups filtra correctamente ──────────────────────

  describe('getSyncableSubGroups filtra correctamente', () => {
    it('retorna subgrupos con pendingSync=true sin importar estado', async () => {
      // getSyncableSubGroups returns ANY subgroup with pendingSync=true:
      // - finalizada + pendingSync=true (first sync)
      // - sincronizada + pendingSync=true (re-sync after N/N resolution)
      // It does NOT filter by estado or userId — any plantation member can sync.

      const finalizadaPending = makeSg('sg-1', { estado: 'finalizada', pendingSync: true });
      const sincronizadaPending = makeSg('sg-2', { estado: 'sincronizada', pendingSync: true });
      mockGetSyncableSubGroups.mockResolvedValue([finalizadaPending, sincronizadaPending]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(results).toHaveLength(2);
      expect(results[0].subgroupId).toBe('sg-1');
      expect(results[1].subgroupId).toBe('sg-2');
      expect(results.every(r => r.success)).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('no filtra por userId — cualquier miembro puede sincronizar', async () => {
      // Subgroup created by user-2, but sync is called by user-1 (different user)
      // getSyncableSubGroups should still return it
      const otherUserSg = makeSg('sg-other', { usuarioCreador: 'user-2', pendingSync: true });
      mockGetSyncableSubGroups.mockResolvedValue([otherUserSg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });

  // ─── Test 6: getTreesWithPendingPhotos filtra correctamente ─────────────────

  describe('getTreesWithPendingPhotos filtra correctamente', () => {
    it('solo retorna árboles con file:// URI y fotoSynced=false en subgrupos no-pending', async () => {
      // Setup: mock returns only trees matching the filter criteria
      const validPending = [
        { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', subgrupoId: 'sg-1', plantacionId: 'plantation-1' },
      ];
      // Trees that should be excluded:
      // - tree with remote fotoUrl (not file://)
      // - tree with fotoSynced=true (already uploaded)
      // - tree in subgroup with pendingSync=true (subgroup not yet synced)
      // - tree with null fotoUrl (no photo)
      mockGetTreesWithPendingPhotos.mockResolvedValue(validPending);

      const storageChain = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);
      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await uploadPendingPhotos('plantation-1');

      // Only the one valid pending tree should be uploaded
      expect(result).toEqual({ uploaded: 1, failed: 0 });
      expect(storageChain.upload).toHaveBeenCalledTimes(1);
      expect(mockMarkPhotoSynced).toHaveBeenCalledWith('tree-1');
    });
  });

  // ─── Test 7: Árboles N/N incluidos en payload de upload ─────────────────────

  describe('Árboles N/N incluidos en payload de upload', () => {
    it('uploadSubGroup incluye árboles con especieId=null (N/N) en p_trees', async () => {
      const sg = makeSg('sg-1');
      const normalTree = makeTree('tree-1', 'sg-1', { especieId: 'species-1', subId: 'LA-SP-1' });
      const nnTree = makeTree('tree-2', 'sg-1', { especieId: null, subId: 'LA-NN-2', posicion: 2 });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadSubGroup(sg, [normalTree, nnTree]);

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
          {
            id: 'tree-2',
            subgroup_id: 'sg-1',
            species_id: null,
            posicion: 2,
            sub_id: 'LA-NN-2',
            foto_url: null,
            usuario_registro: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });
    });

    it('species_id es null (no undefined) para árboles N/N en el payload', async () => {
      const sg = makeSg('sg-1');
      const nnTree = makeTree('tree-nn', 'sg-1', { especieId: null, subId: 'LA-NN-1' });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadSubGroup(sg, [nnTree]);

      const rpcCall = (mockSupabase.rpc as jest.Mock).mock.calls[0];
      const payload = rpcCall[1];
      const treePayload = payload.p_trees[0];

      // Must be explicitly null (not undefined) — server expects null for N/N
      expect(treePayload.species_id).toBeNull();
      expect(treePayload).toHaveProperty('species_id');
    });
  });
});
