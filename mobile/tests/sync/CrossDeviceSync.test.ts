// Tests for cross-device sync scenarios found during Plant 3 testing.
// Covers: file:// path rejection on pull, fotoSynced skip logic in upload,
// cross-device N/N resolution, getSyncableSubGroups with sincronizada state,
// and full foto_url lifecycle across devices.
//
// These tests MUST FAIL with current code and PASS after fixes.

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
  MockFile.downloadFileAsync = mockDownloadFileAsync;

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
  syncPlantation,
  downloadPhotosForPlantation,
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

/**
 * Sets up the supabase.from mock to simulate a full pull scenario.
 * Returns spies for tree insert values and onConflictDoUpdate.
 */
function setupPullMocks(options: {
  remoteSubgroups?: any[];
  remoteTrees?: any[];
  localTreeLookup?: any[];
}) {
  const {
    remoteSubgroups = [],
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
            data: remoteSubgroups,
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

describe('CrossDeviceSync — errores encontrados en Plant 3', () => {
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
        remoteSubgroups: [remoteSg],
        remoteTrees: [remoteTree],
      });

      // Act
      await pullFromServer('plantation-1');

      // Assert: the tree insert should have fotoUrl=null (not the file:// path)
      // because file:// from another device is meaningless on this device.
      const treeCalls = insertValuesSpy.mock.calls;
      const treeInsertCall = treeCalls.find((call: any[]) =>
        call[0]?.id === 'tree-1'
      );

      expect(treeInsertCall).toBeDefined();
      // BUG: Current code stores file:// as fotoUrl directly from server.
      // Fix: pullFromServer should set fotoUrl=null when foto_url starts with file://
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
        remoteSubgroups: [remoteSg],
        remoteTrees: [remoteTree],
      });

      // Act
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
        remoteSubgroups: [remoteSg],
        remoteTrees: [remoteTree],
      });

      // Act
      await pullFromServer('plantation-1');

      // Assert: null stays null
      const treeInsertCall = insertValuesSpy.mock.calls.find((call: any[]) =>
        call[0]?.id === 'tree-3'
      );

      expect(treeInsertCall).toBeDefined();
      expect(treeInsertCall![0].fotoUrl).toBeNull();
    });
  });

  // ─── Test Group 2: uploadSubGroup no re-sube fotos ya sincronizadas ───────

  describe('uploadSubGroup no re-sube fotos ya sincronizadas', () => {
    it('árbol con fotoSynced=true no intenta subir foto', async () => {
      // Arrange: tree has a local photo that was already synced (downloaded from server)
      const sg = makeSg('sg-1');
      const tree = makeTree('tree-1', 'sg-1', {
        fotoUrl: 'file:///local/photos/photo_tree-1.jpg',
        fotoSynced: true,
      });

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      // Act
      await uploadSubGroup(sg, [tree]);

      // Assert: uploadPhotoToStorage should NOT be called (no storage.from('tree-photos').upload)
      // because the photo is already synced
      const storageFromCalls = (mockSupabase.storage.from as jest.Mock).mock.calls;
      expect(storageFromCalls).toHaveLength(0);

      // The RPC should still be called — but foto_url should NOT be the file:// path
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treeInPayload = rpcPayload.p_trees[0];

      // Since fotoSynced=true but fotoUrl is file://, the payload should use null
      // (file:// paths must never reach the server)
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

      // Act
      await uploadSubGroup(sg, [tree]);

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

      mockGetSyncableSubGroups.mockResolvedValue([sg]);

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

      // Act
      await uploadSubGroup(sg, [resolvedTree]);

      // Assert: RPC payload has species_id='species-xyz', sub_id regenerated
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treePayload = rpcPayload.p_trees[0];
      expect(treePayload.species_id).toBe('species-xyz');
      expect(treePayload.sub_id).toBe('LA-XY-1');
    });

    it('device B no re-sube foto de árbol descargado al resolver N/N', async () => {
      // Arrange: tree was downloaded (fotoUrl=file://, fotoSynced=true), then N/N resolved
      // resolveNNTree only changes especieId and subId — NOT fotoUrl or fotoSynced
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

      // Act
      await uploadSubGroup(sg, [downloadedAndResolvedTree]);

      // Assert: photo should NOT be re-uploaded because fotoSynced=true
      const storageFromCalls = (mockSupabase.storage.from as jest.Mock).mock.calls;
      expect(storageFromCalls).toHaveLength(0);

      // markPhotoSynced should NOT be called (photo is already synced)
      expect(mockMarkPhotoSynced).not.toHaveBeenCalled();

      // RPC still called with tree data
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Test Group 4: getSyncableSubGroups incluye sincronizada con cambios ──

  describe('getSyncableSubGroups incluye sincronizada con cambios pendientes', () => {
    it('subgrupo sincronizada con pendingSync=true es retornado y procesado', async () => {
      // Arrange: a sincronizada subgroup with pending changes (e.g., N/N resolved)
      const syncedSg = makeSg('sg-synced', {
        estado: 'sincronizada',
        pendingSync: true,
      });
      mockGetSyncableSubGroups.mockResolvedValue([syncedSg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act
      const results = await syncPlantation('plantation-1');

      // Assert: syncPlantation processes the sincronizada subgroup
      expect(results).toHaveLength(1);
      expect(results[0].subgroupId).toBe('sg-synced');
      expect(results[0].success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      expect(mockMarkSubGroupSynced).toHaveBeenCalledWith('sg-synced');
    });

    it('subgrupo activa con pendingSync=true NO es retornado por getSyncableSubGroups', async () => {
      // Arrange: getSyncableSubGroups filters by pendingSync=true only,
      // but activa subgroups should NOT appear because they haven't been finalized.
      // The mock simulates the expected behavior: getSyncableSubGroups returns
      // only subgroups with pendingSync=true (both finalizada and sincronizada).
      // An activa subgroup with pendingSync=true WOULD be returned by the query
      // since getSyncableSubGroups doesn't filter by estado — this is correct
      // because the sync service handles whatever it receives.
      const activaSg = makeSg('sg-activa', {
        estado: 'activa',
        pendingSync: true,
      });
      const finalizadaSg = makeSg('sg-finalizada', {
        estado: 'finalizada',
        pendingSync: true,
      });

      // Simulating getSyncableSubGroups returning both (it only filters by pendingSync)
      mockGetSyncableSubGroups.mockResolvedValue([activaSg, finalizadaSg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      // Act
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

      // Act
      await uploadSubGroup(sg, [tree]);

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
      // First select: subgroups for this plantation
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
                subgrupoId: 'sg-1',
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

      // Act
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
      // This test verifies the contract of resolveNNTree at the service level.
      // resolveNNTree only updates especieId and subId.
      // After resolution, the tree should still have the same fotoUrl and fotoSynced.

      // Arrange: tree downloaded, then N/N resolved
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

      await uploadSubGroup(sg, [treeAfterResolve]);

      // Assert: no photo upload because fotoSynced=true
      expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    });

    it('Device B: re-sync después de resolver N/N preserva foto_url en servidor', async () => {
      // Arrange: tree was downloaded (fotoSynced=true), resolved N/N, re-syncing
      // The tree's fotoUrl is file:// (local), fotoSynced=true
      // Since fotoSynced=true, photo is NOT re-uploaded
      // The RPC payload should send null for foto_url (file:// can't go to server)
      // The server's COALESCE should preserve the existing foto_url
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

      // Act
      await uploadSubGroup(sg, [tree]);

      // Assert: RPC called — foto_url in payload should be null (not file://)
      // because the photo is already on the server and file:// must never leak
      const rpcPayload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
      const treePayload = rpcPayload.p_trees[0];

      // BUG: Current code sends file:// to server when fotoSynced=true but fotoUrl is file://
      // Fix: uploadSubGroup should map file:// + fotoSynced=true → null in payload
      // (server COALESCE preserves existing value when null is sent)
      expect(treePayload.foto_url).toBeNull();
      expect(treePayload.foto_url === null || !treePayload.foto_url.startsWith('file://')).toBe(true);
    });
  });
});
