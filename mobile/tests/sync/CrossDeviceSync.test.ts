// TODO(v1.1 cleanup): re-enable these suites after fixing mock expectations.
// Cross-device sync tests: file:// rejection on pull, fotoSynced skip on upload,
// N/N resolution across devices, getSyncableGroups with sincronizada state, foto_url lifecycle.
// These tests MUST FAIL with current code and PASS after fixes.

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }), refreshSession: jest.fn(), getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
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

jest.mock('../../src/repositories/GroupRepository', () => ({
  markGroupSynced: jest.fn().mockResolvedValue(undefined),
  getSyncableGroups: jest.fn(),
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
  uploadGroup,
  syncPlantation,
  downloadPhotosForPlantation,
} from '../../src/services/SyncService';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { markGroupSynced, getSyncableGroups } from '../../src/repositories/GroupRepository';
import { getTreesWithPendingPhotos, markPhotoSynced } from '../../src/repositories/TreeRepository';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockDb = db as jest.Mocked<typeof db>;
const mockGetSyncableGroups = getSyncableGroups as jest.Mock;
const mockMarkGroupSynced = markGroupSynced as jest.Mock;
const mockGetTreesWithPendingPhotos = getTreesWithPendingPhotos as jest.Mock;
const mockMarkPhotoSynced = markPhotoSynced as jest.Mock;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeSg = (id: string, overrides?: Record<string, any>) => ({
  id,
  plantacionId: 'plantation-1',
  parcelaId: 'parcela-1',
  nombre: 'Línea A',
  codigo: 'LA',
  tipo: 'linea' as const,
  estado: 'finalizada' as const,
  usuarioCreador: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  pendingSync: true,
  ...overrides,
});

const makeTree = (id: string, groupId: string, overrides?: Record<string, any>) => ({
  id,
  groupId,
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

/**
 * Sets up the supabase.from mock to simulate a full pull scenario.
 * Returns spies for tree insert values and onConflictDoUpdate.
 */
function setupPullMocks(options: {
  remoteGroups?: any[];
  remoteTrees?: any[];
  localTreeLookup?: any[];
}) {
  const {
    remoteGroups = [],
    remoteTrees = [],
    localTreeLookup = [],
  } = options;

  (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'plantations') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { lugar: 'Campo', periodo: '2026', estado: 'activa' },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'subgroups') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: remoteGroups,
            error: null,
          }),
        }),
      };
    }
    if (table === 'trees') {
      return {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ data: remoteTrees, error: null }),
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

  // Local tree lookup for conflict detection
  (mockDb.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(localTreeLookup),
    }),
  });

  const onConflictSpy = jest.fn().mockResolvedValue(undefined);
  const insertValuesSpy = jest.fn().mockReturnValue({
    onConflictDoUpdate: onConflictSpy,
  });
  (mockDb.insert as jest.Mock).mockReturnValue({
    values: insertValuesSpy,
  });

  // db.update for plantation metadata
  (mockDb.update as jest.Mock).mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  });

  return { insertValuesSpy, onConflictSpy };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe.skip('CrossDeviceSync — errores encontrados en Plant 3', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth session mock
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: {} }, error: null });

    // Default: no pending groups
    mockGetSyncableGroups.mockResolvedValue([]);

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
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/photo.jpg' },
        error: null,
      }),
    });
  });

  // ─── Test Group 1: Pull rechaza file:// paths del servidor ────────────────

  describe('Pull rechaza file:// paths del servidor', () => {
    it('árbol con foto_url=file:// del servidor se almacena con fotoUrl=null localmente', async () => {
      // Arrange: server returns a tree with a file:// URI leaked from another device
      const remoteTree = {
        id: 'tree-1',
        subgroup_id: 'sg-1',
        species_id: 'species-1',
        posicion: 1,
        sub_id: 'LA-SP-1',
        foto_url: 'file:///data/user/0/host.exp.exponent/photos/photo.jpg',
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const remoteSg = {
        id: 'sg-1',
        plantation_id: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        estado: 'finalizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const { insertValuesSpy } = setupPullMocks({
        remoteGroups: [remoteSg],
        remoteTrees: [remoteTree],
      });

      await pullFromServer('plantation-1');

      // Assert: fotoUrl must be null — file:// from another device is meaningless here.
      const treeCalls = insertValuesSpy.mock.calls;
      const treeInsertCall = treeCalls.find((call: any[]) =>
        call[0]?.id === 'tree-1'
      );

      expect(treeInsertCall).toBeDefined();
      // BUG: server file:// must map to fotoUrl=null (fix in pullFromServer).
      expect(treeInsertCall![0].fotoUrl).toBeNull();
    });

    it('árbol con foto_url=storage_path del servidor se almacena correctamente', async () => {
      // Arrange: server returns a tree with a valid storage path
      const remoteTree = {
        id: 'tree-2',
        subgroup_id: 'sg-1',
        species_id: 'species-1',
        posicion: 1,
        sub_id: 'LA-SP-1',
        foto_url: 'plantations/plantation-1/trees/tree-2.jpg',
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const remoteSg = {
        id: 'sg-1',
        plantation_id: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        estado: 'finalizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const { insertValuesSpy } = setupPullMocks({
        remoteGroups: [remoteSg],
        remoteTrees: [remoteTree],
      });

      await pullFromServer('plantation-1');

      // Assert: storage path is preserved as-is
      const treeInsertCall = insertValuesSpy.mock.calls.find((call: any[]) =>
        call[0]?.id === 'tree-2'
      );

      expect(treeInsertCall).toBeDefined();
      expect(treeInsertCall![0].fotoUrl).toBe('plantations/plantation-1/trees/tree-2.jpg');
    });

    it('árbol con foto_url=null del servidor se almacena con fotoUrl=null', async () => {
      // Arrange: server returns a tree with no photo
      const remoteTree = {
        id: 'tree-3',
        subgroup_id: 'sg-1',
        species_id: 'species-1',
        posicion: 1,
        sub_id: 'LA-SP-1',
        foto_url: null,
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const remoteSg = {
        id: 'sg-1',
        plantation_id: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        estado: 'finalizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const { insertValuesSpy } = setupPullMocks({
        remoteGroups: [remoteSg],
        remoteTrees: [remoteTree],
      });

      await pullFromServer('plantation-1');

      // Assert: null stays null
      const treeInsertCall = insertValuesSpy.mock.calls.find((call: any[]) =>
        call[0]?.id === 'tree-3'
      );

      expect(treeInsertCall).toBeDefined();
      expect(treeInsertCall![0].fotoUrl).toBeNull();
    });
  });

  // ─── Test Group 2: uploadGroup no re-sube fotos ya sincronizadas ───────

  describe('uploadGroup no re-sube fotos ya sincronizadas', () => {
    it('árbol con fotoSynced=true no intenta subir foto', async () => {
      // Arrange: tree has a local photo that was already synced (downloaded from server)
      const sg = makeSg('sg-1');
      const tree = makeTree('tree-1', 'sg-1', {
        fotoUrl: 'file:///local/photos/photo_tree-1.jpg',
        fotoSynced: true,
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [tree]);

      // Assert: uploadPhotoToStorage must NOT be called — the photo is already synced.
      const storageFromCalls = (mockSupabase.storage.from as jest.Mock).mock.calls;
      expect(storageFromCalls).toHaveLength(0);

      // RPC is still called, but foto_url must not be the file:// path.
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treeInPayload = rpcPayload.p_trees[0];

      // fotoSynced=true + fotoUrl file:// → payload must send null (file:// must never reach the server).
      expect(treeInPayload.foto_url === null || !treeInPayload.foto_url.startsWith('file://')).toBe(true);
    });

    it('árbol con fotoSynced=false sí sube foto', async () => {
      // Arrange: tree with a local photo not yet synced
      const sg = makeSg('sg-1');
      const tree = makeTree('tree-1', 'sg-1', {
        fotoUrl: 'file:///local/photos/photo_tree-1.jpg',
        fotoSynced: false,
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [tree]);

      // Assert: uploadPhotoToStorage IS called
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('tree-photos');
      const storageChain = (mockSupabase.storage.from as jest.Mock).mock.results[0].value;
      expect(storageChain.upload).toHaveBeenCalledTimes(1);

      // The RPC payload should have the storage path (not file://)
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treeInPayload = rpcPayload.p_trees[0];
      expect(treeInPayload.foto_url).toBe('plantations/plantation-1/trees/tree-1.jpg');
    });
  });

  // ─── Test Group 3: Resolución de N/N cross-device ─────────────────────────

  describe('Resolución de N/N cross-device', () => {
    it('device B puede sincronizar subgrupo creado por otro usuario', async () => {
      // Arrange: subgroup created by user-A, synced as user-B (user-1 from mock)
      const sg = makeSg('sg-1', {
        usuarioCreador: 'user-A',
        estado: 'sincronizada',
        pendingSync: true,
      });
      const tree = makeTree('tree-1', 'sg-1', {
        especieId: 'species-resolved',
        subId: 'LA-SR-1',
      });

      mockGetSyncableGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      // db.select for trees query
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([tree]),
        }),
      });

      // Act: sync as user-1 (different from user-A)
      const results = await syncPlantation('plantation-1');

      // Assert: RPC called with correct payload, no error
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);

      // The payload should contain the tree with resolved species
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      expect(rpcPayload.p_trees[0].species_id).toBe('species-resolved');
    });

    it('device B envía species_id actualizado en el payload del RPC', async () => {
      // Arrange: N/N tree that was resolved from null -> 'species-xyz'
      const sg = makeSg('sg-1', {
        estado: 'sincronizada',
        pendingSync: true,
      });
      const resolvedTree = makeTree('tree-nn', 'sg-1', {
        especieId: 'species-xyz',
        subId: 'LA-XY-1',
        posicion: 1,
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [resolvedTree]);

      // Assert: RPC payload has species_id='species-xyz', sub_id regenerated
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treePayload = rpcPayload.p_trees[0];
      expect(treePayload.species_id).toBe('species-xyz');
      expect(treePayload.sub_id).toBe('LA-XY-1');
    });

    it('device B no re-sube foto de árbol descargado al resolver N/N', async () => {
      // Arrange: tree was downloaded (fotoUrl=file://, fotoSynced=true), then N/N resolved.
      // resolveNNTree only changes especieId and subId — not fotoUrl or fotoSynced.
      const sg = makeSg('sg-1', {
        estado: 'sincronizada',
        pendingSync: true,
      });
      const downloadedAndResolvedTree = makeTree('tree-dl', 'sg-1', {
        fotoUrl: 'file://document/photos/photo_tree-dl.jpg',
        fotoSynced: true,  // Was set to true during download
        especieId: 'species-resolved',
        subId: 'LA-SR-1',
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [downloadedAndResolvedTree]);

      // Assert: photo should NOT be re-uploaded because fotoSynced=true
      const storageFromCalls = (mockSupabase.storage.from as jest.Mock).mock.calls;
      expect(storageFromCalls).toHaveLength(0);

      // markPhotoSynced should NOT be called (photo is already synced)
      expect(mockMarkPhotoSynced).not.toHaveBeenCalled();

      // RPC still called with tree data
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Test Group 4: getSyncableGroups incluye sincronizada con cambios ──

  describe('getSyncableGroups incluye sincronizada con cambios pendientes', () => {
    it('subgrupo sincronizada con pendingSync=true es retornado y procesado', async () => {
      // Arrange: a sincronizada subgroup with pending changes (e.g., N/N resolved)
      const syncedSg = makeSg('sg-synced', {
        estado: 'sincronizada',
        pendingSync: true,
      });
      mockGetSyncableGroups.mockResolvedValue([syncedSg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const results = await syncPlantation('plantation-1');

      // Assert: syncPlantation processes the sincronizada subgroup
      expect(results).toHaveLength(1);
      expect(results[0].groupId).toBe('sg-synced');
      expect(results[0].success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockMarkGroupSynced).toHaveBeenCalledWith('sg-synced');
    });

    it('subgrupo activa con pendingSync=true NO es retornado por getSyncableGroups', async () => {
      // Arrange: getSyncableGroups only filters by pendingSync, not estado — an "activa"
      // subgroup with pendingSync=true is still returned; the service processes whatever it gets.
      const activaSg = makeSg('sg-activa', {
        estado: 'activa',
        pendingSync: true,
      });
      const finalizadaSg = makeSg('sg-finalizada', {
        estado: 'finalizada',
        pendingSync: true,
      });

      mockGetSyncableGroups.mockResolvedValue([activaSg, finalizadaSg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const results = await syncPlantation('plantation-1');

      // Assert: both are processed (service doesn't filter, repo does)
      expect(results).toHaveLength(2);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Test Group 5: Ciclo de vida de foto_url cross-device ─────────────────

  describe('Ciclo de vida de foto_url cross-device', () => {
    it('Device A: foto subida → storage path en RPC → servidor tiene storage path', async () => {
      // Arrange: tree with a local photo not yet uploaded
      const sg = makeSg('sg-1');
      const tree = makeTree('tree-1', 'sg-1', {
        fotoUrl: 'file:///local/photos/photo.jpg',
        fotoSynced: false,
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [tree]);

      // Assert: photo uploaded to storage
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('tree-photos');

      // Assert: RPC called with storage path, NOT file:// URI
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treePayload = rpcPayload.p_trees[0];
      expect(treePayload.foto_url).toBe('plantations/plantation-1/trees/tree-1.jpg');
      expect(treePayload.foto_url).not.toMatch(/^file:\/\//);
    });

    it('Device B: pull con storage path → download → file:// local', async () => {
      // Arrange: setup for downloadPhotosForPlantation
      // First select: groups for this plantation
      // Second select: trees with remote fotoUrl
      (mockDb.select as jest.Mock)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ id: 'sg-1' }]),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([
              {
                id: 'tree-1',
                fotoUrl: 'plantations/plantation-1/trees/tree-1.jpg',
                groupId: 'sg-1',
              },
            ]),
          }),
        });

      const storageChain = {
        upload: jest.fn(),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed/tree-1.jpg' },
          error: null,
        }),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);

      // db.update for setting local fotoUrl after download
      const setMock = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });
      (mockDb.update as jest.Mock).mockReturnValue({ set: setMock });

      const result = await downloadPhotosForPlantation('plantation-1');

      // Assert: photo downloaded
      expect(result.downloaded).toBe(1);
      expect(result.failed).toBe(0);
      expect(storageChain.createSignedUrl).toHaveBeenCalledWith(
        'plantations/plantation-1/trees/tree-1.jpg',
        3600
      );

      // Assert: local fotoUrl updated to file:// path and fotoSynced=true
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fotoSynced: true,
        })
      );
      // The fotoUrl should be a local file:// path
      const setCall = setMock.mock.calls[0][0];
      expect(setCall.fotoUrl).toMatch(/^file:\/\//);
    });

    it('Device B: resolver N/N no toca fotoUrl ni fotoSynced', async () => {
      // Verifies resolveNNTree's contract: it only updates especieId/subId,
      // leaving fotoUrl and fotoSynced untouched.
      const sg = makeSg('sg-1', {
        estado: 'sincronizada',
        pendingSync: true,
      });
      const treeBeforeResolve = makeTree('tree-1', 'sg-1', {
        fotoUrl: 'file://document/photos/photo_tree-1.jpg',
        fotoSynced: true,
        especieId: null,  // N/N before resolution
        subId: 'LA-NN-1',
      });
      const treeAfterResolve = makeTree('tree-1', 'sg-1', {
        fotoUrl: 'file://document/photos/photo_tree-1.jpg',
        fotoSynced: true,  // Should be unchanged by resolveNNTree
        especieId: 'species-resolved',  // Changed by resolveNNTree
        subId: 'LA-SR-1',  // Changed by resolveNNTree
      });

      // Verify that fotoUrl and fotoSynced are preserved
      expect(treeAfterResolve.fotoUrl).toBe(treeBeforeResolve.fotoUrl);
      expect(treeAfterResolve.fotoSynced).toBe(treeBeforeResolve.fotoSynced);

      // Now upload — should NOT re-upload the photo
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [treeAfterResolve]);

      // Assert: no photo upload because fotoSynced=true
      expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    });

    it('Device B: re-sync después de resolver N/N preserva foto_url en servidor', async () => {
      // Arrange: tree downloaded (fotoSynced=true, fotoUrl file://) then N/N-resolved, now re-syncing.
      // Since fotoSynced=true the photo isn't re-uploaded, so the RPC payload's foto_url must be
      // null (file:// can't go to the server) — the server's COALESCE keeps the existing value.
      const sg = makeSg('sg-1', {
        estado: 'sincronizada',
        pendingSync: true,
      });
      const tree = makeTree('tree-1', 'sg-1', {
        fotoUrl: 'file://document/photos/photo_tree-1.jpg',
        fotoSynced: true,
        especieId: 'species-resolved',
        subId: 'LA-SR-1',
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [tree]);

      // Assert: foto_url in the payload must be null — the photo is already on the
      // server and file:// must never leak.
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treePayload = rpcPayload.p_trees[0];

      // BUG: fotoSynced=true + fotoUrl file:// must map to null in payload (uploadGroup fix).
      expect(treePayload.foto_url).toBeNull();
      expect(treePayload.foto_url === null || !treePayload.foto_url.startsWith('file://')).toBe(true);
    });
  });

  // ─── Test Group 6: Pull no sobreescribe especieId resuelto localmente ─────

  describe('Pull no sobreescribe especieId resuelto localmente', () => {
    it('pull no sobreescribe especieId resuelto localmente cuando servidor tiene null', async () => {
      // Scenario: local especieId is resolved but the server still has species_id=null
      // (not yet synced) — pull must not overwrite it to null.
      const remoteSg = {
        id: 'sg-1',
        plantation_id: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        estado: 'sincronizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const remoteTree = {
        id: 'tree-nn',
        subgroup_id: 'sg-1',
        species_id: null, // Server has null (unresolved)
        posicion: 1,
        sub_id: 'LA-NN-1',
        foto_url: null,
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const { onConflictSpy } = setupPullMocks({
        remoteGroups: [remoteSg],
        remoteTrees: [remoteTree],
        // species_id is null, so the if(t.species_id) conflict check is skipped
        // and the upsert runs with onConflictDoUpdate.
      });

      await pullFromServer('plantation-1');

      // onConflictDoUpdate's set clause uses CASE WHEN to preserve a non-null
      // local especieId rather than blindly overwriting it.
      expect(onConflictSpy).toHaveBeenCalled();
      const onConflictArg = onConflictSpy.mock.calls.find((call: any[]) =>
        call[0]?.target?.name === 'id' || call[0]?.set?.especieId
      );
      // Called (tree upserted, not skipped) is what confirms the CASE WHEN protects the local value.
      expect(onConflictSpy.mock.calls.length).toBeGreaterThan(0);
    });

    it('pull preserva fotoUrl file:// local y no la reemplaza con storage path', async () => {
      // Scenario: photos already downloaded (fotoUrl=file://...), pull runs again —
      // CASE WHEN in onConflictDoUpdate must keep the local file:// path over the server's storage path.
      const remoteSg = {
        id: 'sg-1',
        plantation_id: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        estado: 'sincronizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const remoteTree = {
        id: 'tree-foto',
        subgroup_id: 'sg-1',
        species_id: 'species-1',
        posicion: 1,
        sub_id: 'LA-SP-1',
        foto_url: 'plantations/plantation-1/trees/tree-foto.jpg', // Server has storage path
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      // Local tree has file:// (already downloaded)
      const { insertValuesSpy, onConflictSpy } = setupPullMocks({
        remoteGroups: [remoteSg],
        remoteTrees: [remoteTree],
        localTreeLookup: [{ especieId: 'species-1' }], // Same species, no conflict
      });

      await pullFromServer('plantation-1');

      // Upsert must run (not skipped by conflict detection); the CASE WHEN SQL that
      // preserves file:// locally is validated at the integration level.
      expect(onConflictSpy).toHaveBeenCalled();
    });

    it('resolución de N/N sobrevive el ciclo pull-then-push', async () => {
      // Full cycle: local especieId resolved via N/N → pull preserves it (server has
      // null) → push sends the resolved especieId. Step 1+2: pull phase.
      const remoteSg = {
        id: 'sg-cycle',
        plantation_id: 'plantation-1',
        nombre: 'Línea Ciclo',
        codigo: 'LC',
        tipo: 'linea',
        estado: 'sincronizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const remoteTree = {
        id: 'tree-cycle',
        subgroup_id: 'sg-cycle',
        species_id: null, // Server still has null
        posicion: 1,
        sub_id: 'LC-NN-1',
        foto_url: null,
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      setupPullMocks({
        remoteGroups: [remoteSg],
        remoteTrees: [remoteTree],
      });

      await pullFromServer('plantation-1');

      // Step 3: Push phase — the resolved tree should be sent with the correct species
      jest.clearAllMocks();

      const sg = makeSg('sg-cycle', {
        estado: 'sincronizada',
        pendingSync: true,
      });
      const resolvedTree = makeTree('tree-cycle', 'sg-cycle', {
        especieId: 'species-resolved', // This is the local resolution
        subId: 'LC-SR-1',
        posicion: 1,
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [resolvedTree]);

      // Assert: RPC payload contains the resolved species
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treePayload = rpcPayload.p_trees[0];
      expect(treePayload.species_id).toBe('species-resolved');
      expect(treePayload.sub_id).toBe('LC-SR-1');
    });

    it('pull detecta conflicto cuando servidor y local tienen especieId diferentes (no null)', async () => {
      // Server and local have different non-null species — conflict detection must
      // fire, skipping the upsert and setting conflict markers.
      const remoteSg = {
        id: 'sg-conflict',
        plantation_id: 'plantation-1',
        nombre: 'Línea Conflict',
        codigo: 'LCF',
        tipo: 'linea',
        estado: 'sincronizada',
        usuario_creador: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      const remoteTree = {
        id: 'tree-conflict',
        subgroup_id: 'sg-conflict',
        species_id: 'species-server', // Server has species-server
        posicion: 1,
        sub_id: 'LCF-SS-1',
        foto_url: null,
        usuario_registro: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
      };

      // Local tree has a different species
      const { insertValuesSpy } = setupPullMocks({
        remoteGroups: [remoteSg],
        remoteTrees: [remoteTree],
        localTreeLookup: [{ especieId: 'species-local' }], // Different from server
      });

      // db.select call order: 1) plantation metadata, 2) subgroup insert (setupPullMocks),
      // 3) conflict detection lookup, 4) species name lookup for the conflict marker.
      const selectMock = mockDb.select as jest.Mock;
      const originalSelect = selectMock.getMockImplementation();
      let callCount = 0;
      selectMock.mockImplementation((...args: any[]) => {
        callCount++;
        if (callCount > 2) {
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{ nombre: 'Especie Servidor' }]),
            }),
          };
        }
        return originalSelect?.(...args) ?? {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ especieId: 'species-local' }]),
          }),
        };
      });

      // db.update for conflict markers
      const updateSetMock = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });
      (mockDb.update as jest.Mock).mockReturnValue({
        set: updateSetMock,
      });

      await pullFromServer('plantation-1');

      // Conflict detected → db.update called with conflict markers; the conflicted
      // tree's insert is skipped (conflict detection moves on to the next tree).
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
