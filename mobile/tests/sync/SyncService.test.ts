// Tests for SyncService: sync ordering, RPC payloads, error handling, photo upload/download.

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
  syncPlantation,
  uploadGroup,
  uploadPendingPhotos,
  downloadPhotosForPlantation,
  getErrorMessage,
} from '../../src/services/SyncService';

import { supabase } from '../../src/supabase/client';
import { db } from '../../src/database/client';
import { markGroupSynced, getSyncableGroups } from '../../src/repositories/GroupRepository';
import { getTreesWithPendingPhotos, markPhotoSynced } from '../../src/repositories/TreeRepository';
import { File as ExpoFile } from 'expo-file-system';
import { FOTOS_EN_PARALELO } from '../../src/services/sync/concurrencia';
import type { PhotoSyncProgress } from '../../src/services/sync/types';
import { SyncCanceladoError } from '../../src/services/sync/cancelacion';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockGetFinalizadaSubGroups = getSyncableGroups as jest.Mock;
const mockMarkGroupSynced = markGroupSynced as jest.Mock;
const mockDb = db as jest.Mocked<typeof db>;
const mockGetTreesWithPendingPhotos = getTreesWithPendingPhotos as jest.Mock;
const mockMarkPhotoSynced = markPhotoSynced as jest.Mock;

const mockDownloadFileAsync = ExpoFile.downloadFileAsync as jest.Mock;

// where() resuelve a `rows` al await y además soporta .limit(1): el gate de
// parcela (#90, codigoDeParcelaLista) consulta la parcela del grupo y debe
// encontrarla lista (pendingSync=false, sin tombstone).
function whereResult(rows: unknown) {
  return Object.assign(Promise.resolve(rows), {
    limit: jest.fn().mockResolvedValue([{ codigo: 'P1' }]),
  });
}

// El update de foto_url pide las filas afectadas (#482).
function updateQueAfecta(filas: unknown[] = [{ id: 'tree' }]) {
  return jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: filas, error: null }),
    }),
  });
}

const makeSg = (id: string, nombre = 'Línea A') => ({
  id,
  plantacionId: 'plantation-1',
  parcelaId: 'parcela-1',
  nombre,
  codigo: 'LA',
  tipo: 'linea' as const,
  estado: 'finalizada' as const,
  usuarioCreador: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
});

const makeTrees = (groupId: string) => [
  {
    id: 'tree-1',
    groupId,
    especieId: 'species-1',
    posicion: 1,
    subId: 'LA-SP-1',
    fotoUrl: null,
    plantacionId: 1,
    globalId: 1,
    usuarioRegistro: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth session mock
    (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: {} }, error: null });

    // Default: no pending groups
    mockGetFinalizadaSubGroups.mockResolvedValue([]);

    // Default: no pending photos
    mockGetTreesWithPendingPhotos.mockResolvedValue([]);
    mockMarkPhotoSynced.mockResolvedValue(undefined);

    // Default: empty trees select
    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue(whereResult([])),
      }),
    });

    // Default: supabase.from chain for pull
    (mockSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      update: updateQueAfecta(),
    });

    // Default: db.insert chain for upsert
    (mockDb.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    });

    // Default: db.update chain
    (mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue(whereResult(undefined)),
      }),
    });

    // Default: supabase.storage chain
    (mockSupabase.storage.from as jest.Mock).mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/photo.jpg' }, error: null }),
    });
  });

  describe('syncPlantation — pull-then-push order', () => {
    it('calls pullFromServer (supabase.from) BEFORE uploading any Groups', async () => {
      const callOrder: string[] = [];

      (mockSupabase.from as jest.Mock).mockImplementation(() => {
        callOrder.push('pull');
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockImplementation(() => {
        callOrder.push('rpc_upload');
        return Promise.resolve({ data: { success: true }, error: null });
      });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereResult([])),
        }),
      });

      await syncPlantation('plantation-1');

      // Pull (from calls) should happen before upload (rpc call)
      const firstPullIndex = callOrder.indexOf('pull');
      const firstRpcIndex = callOrder.indexOf('rpc_upload');
      expect(firstPullIndex).toBeGreaterThanOrEqual(0);
      expect(firstRpcIndex).toBeGreaterThan(firstPullIndex);
    });
  });

  describe('uploadGroup — RPC payload', () => {
    it('calls supabase.rpc with correct p_subgroup and p_trees payload', async () => {
      const sgTrees = makeTrees('sg-1');

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      const sg1 = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg1]);

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereResult(sgTrees)),
        }),
      });

      await syncPlantation('plantation-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('sync_subgroup', {
        p_subgroup: {
          id: 'sg-1',
          plantation_id: 'plantation-1',
          parcela_id: 'parcela-1',
          nombre: 'Línea A',
          codigo: 'LA',
          tipo: 'linea',
          estado: 'finalizada',
          usuario_creador: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
          parcela_codigo: 'P1',
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
            latitude: null,
            longitude: null,
            gps_accuracy: null,
            gps_captured_at: null,
          },
        ],
      });
    });
  });

  // Marcarla antes del RPC hacía que el reintento la salteara y mandara foto_url null (#489).
  describe('uploadGroup — la foto se marca sincronizada solo tras el RPC exitoso', () => {
    const sg = { ...makeSg('sg-1'), pendingSync: true };
    const arbolConFoto = {
      ...makeTrees('sg-1')[0],
      fotoUrl: 'file://document/photos/photo_1.jpg',
      fotoSynced: false,
    };
    const pathEnStorage = 'plantations/plantation-1/parcelas/parcela-1/trees/tree-1.jpg';

    beforeEach(() => {
      (mockSupabase.storage.from as jest.Mock).mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
      });
    });

    it('RPC exitoso: marca la foto', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      await uploadGroup(sg, [arbolConFoto], 'P1');

      expect(mockMarkPhotoSynced).toHaveBeenCalledWith('tree-1');
    });

    it('RPC con error de red: NO marca la foto', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'Network request failed' } });

      await uploadGroup(sg, [arbolConFoto], 'P1');

      expect(mockMarkPhotoSynced).not.toHaveBeenCalled();
    });

    it('RPC rechazado por el server: NO marca la foto', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: false, error: 'UNKNOWN' }, error: null });

      await uploadGroup(sg, [arbolConFoto], 'P1');

      expect(mockMarkPhotoSynced).not.toHaveBeenCalled();
    });

    it('RPC que tira excepción: NO marca la foto', async () => {
      (mockSupabase.rpc as jest.Mock).mockRejectedValue(new Error('timeout'));

      await expect(uploadGroup(sg, [arbolConFoto], 'P1')).rejects.toThrow('timeout');

      expect(mockMarkPhotoSynced).not.toHaveBeenCalled();
    });

    it('el reintento resube al mismo path con upsert y manda foto_url', async () => {
      const upload = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.storage.from as jest.Mock).mockReturnValue({ upload });
      (mockSupabase.rpc as jest.Mock)
        .mockResolvedValueOnce({ data: { success: false, error: 'UNKNOWN' }, error: null })
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      await uploadGroup(sg, [arbolConFoto], 'P1');
      await uploadGroup(sg, [arbolConFoto], 'P1');

      expect(upload).toHaveBeenCalledTimes(2);
      for (const [path, , opciones] of upload.mock.calls) {
        expect(path).toBe(pathEnStorage);
        expect(opciones).toEqual(expect.objectContaining({ upsert: true }));
      }
      const payloadReintento = (mockSupabase.rpc as jest.Mock).mock.calls[1][1];
      expect(payloadReintento.p_trees[0].foto_url).toBe(pathEnStorage);
      expect(mockMarkPhotoSynced).toHaveBeenCalledTimes(1);
    });
  });

  describe('estado real en el payload (no hardcode)', () => {
    async function rpcEstadoFor(estado: string): Promise<string> {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });
      mockGetFinalizadaSubGroups.mockResolvedValue([{ ...makeSg('sg-1'), estado }]);
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue(whereResult([])) }),
      });
      await syncPlantation('plantation-1');
      const call = (mockSupabase.rpc as jest.Mock).mock.calls.at(-1);
      return call[1].p_subgroup.estado;
    }

    it("envía 'activa' tal cual (no lo hardcodea a finalizada)", async () => {
      expect(await rpcEstadoFor('activa')).toBe('activa');
    });

    it("envía 'finalizada' tal cual", async () => {
      expect(await rpcEstadoFor('finalizada')).toBe('finalizada');
    });

    it("envía 'sincronizada' tal cual (el server la mapea a finalizada)", async () => {
      expect(await rpcEstadoFor('sincronizada')).toBe('sincronizada');
    });
  });

  describe('markGroupSynced state transitions', () => {
    it('calls markGroupSynced when RPC returns success: true', async () => {
      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereResult([])),
        }),
      });

      await syncPlantation('plantation-1');

      expect(mockMarkGroupSynced).toHaveBeenCalledWith('sg-1');
    });

    it('does NOT call markGroupSynced on DUPLICATE_CODE error', async () => {
      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: false, error: 'DUPLICATE_CODE' },
        error: null,
      });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereResult([])),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(mockMarkGroupSynced).not.toHaveBeenCalled();
      expect(results[0].success).toBe(false);
      if (!results[0].success) {
        expect(results[0].error).toBe('DUPLICATE_CODE');
      }
    });

    it('does NOT call markGroupSynced on network error', async () => {
      const sg = makeSg('sg-1');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg]);

      (mockSupabase.rpc as jest.Mock).mockRejectedValue(new Error('Network Error'));

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereResult([])),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(mockMarkGroupSynced).not.toHaveBeenCalled();
      expect(results[0].success).toBe(false);
      if (!results[0].success) {
        expect(results[0].error).toBe('NETWORK');
      }
    });
  });

  describe('error accumulation — continue-on-failure', () => {
    it('all 3 Groups attempted even when 2nd fails', async () => {
      const sg1 = makeSg('sg-1', 'Línea A');
      const sg2 = makeSg('sg-2', 'Línea B');
      const sg3 = makeSg('sg-3', 'Línea C');
      mockGetFinalizadaSubGroups.mockResolvedValue([sg1, sg2, sg3]);

      (mockSupabase.rpc as jest.Mock)
        .mockResolvedValueOnce({ data: { success: true }, error: null })
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereResult([])),
        }),
      });

      const results = await syncPlantation('plantation-1');

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('getErrorMessage — Spanish error messages', () => {
    it('DUPLICATE_CODE returns Spanish message containing "ya existe"', () => {
      const msg = getErrorMessage('DUPLICATE_CODE');
      expect(msg).toMatch(/ya existe/i);
    });

    it('NETWORK returns Spanish message containing "conexión"', () => {
      const msg = getErrorMessage('NETWORK');
      expect(msg).toMatch(/conexión/i);
    });
  });

  describe('uploadPendingPhotos — photo upload', () => {
    it('uploads each pending photo and marks synced', async () => {
      const pending = [
        { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
        { id: 'tree-2', fotoUrl: 'file://document/photos/photo_2.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
      ];
      mockGetTreesWithPendingPhotos.mockResolvedValue(pending);

      const storageChain = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);
      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: updateQueAfecta(),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await uploadPendingPhotos('plantation-1');

      expect(storageChain.upload).toHaveBeenCalledTimes(2);
      expect(mockMarkPhotoSynced).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ uploaded: 2, failed: 0 });
    });

    it('continues on single upload failure — returns { uploaded: 1, failed: 1 }', async () => {
      const pending = [
        { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
        { id: 'tree-2', fotoUrl: 'file://document/photos/photo_2.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
      ];
      mockGetTreesWithPendingPhotos.mockResolvedValue(pending);

      const storageChain = {
        upload: jest.fn()
          .mockResolvedValueOnce({ error: { message: 'Upload failed' } })
          .mockResolvedValueOnce({ error: null }),
        createSignedUrl: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);
      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: updateQueAfecta(),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await uploadPendingPhotos('plantation-1');

      expect(result).toEqual({ uploaded: 1, failed: 1 });
    });

    // Con N fotos en vuelo el índice del loop ya no es el avance: la primera en
    // arrancar puede ser la última en terminar y el contador retrocedería (#449).
    it('sube de a FOTOS_EN_PARALELO y el progreso cuenta completadas, no el índice', async () => {
      const pending = Array.from({ length: 5 }, (_, i) => ({
        id: `tree-${i}`, fotoUrl: `file://document/photos/photo_${i}.jpg`, grupoId: 'sg-1', plantacionId: 'plantation-1',
      }));
      mockGetTreesWithPendingPhotos.mockResolvedValue(pending);

      let enVuelo = 0;
      let pico = 0;
      const storageChain = {
        // La foto 0 termina última: la más lenta es la primera en arrancar.
        upload: jest.fn().mockImplementation((path: string) => {
          enVuelo++;
          pico = Math.max(pico, enVuelo);
          return new Promise((resolver) =>
            setTimeout(() => { enVuelo--; resolver({ error: null }); }, path.includes('tree-0') ? 30 : 1),
          );
        }),
        createSignedUrl: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);
      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: updateQueAfecta(),
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) }),
      });

      const completadas: number[] = [];
      const result = await uploadPendingPhotos('plantation-1', (p) => completadas.push(p.completed));

      expect(pico).toBe(FOTOS_EN_PARALELO);
      expect(completadas).toEqual([0, 1, 2, 3, 4, 5]);
      expect(result).toEqual({ uploaded: 5, failed: 0 });
    });

    // El indicador de velocidad se alimenta de acá: el archivo ya se materializa
    // entero para subirlo, así que los bytes no cuestan una lectura de más (#450).
    it('acumula los bytes subidos y la marca de arranque en el progreso', async () => {
      const pending = [
        { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
        { id: 'tree-2', fotoUrl: 'file://document/photos/photo_2.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
      ];
      mockGetTreesWithPendingPhotos.mockResolvedValue(pending);
      const storageChain = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);
      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: updateQueAfecta(),
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) }),
      });

      const progresos: PhotoSyncProgress[] = [];
      await uploadPendingPhotos('plantation-1', (p) => progresos.push({ ...p }));

      const ultimo = progresos[progresos.length - 1];
      // El doble de ExpoFile devuelve un arrayBuffer de tamaño fijo por foto.
      expect(ultimo.bytes).toBeGreaterThan(0);
      expect(ultimo.desde).toEqual(expect.any(Number));
      // Monótono: los bytes nunca retroceden entre emisiones.
      const bytes = progresos.map((p) => p.bytes ?? 0);
      expect(bytes).toEqual([...bytes].sort((a, b) => a - b));
    });

    // Lo que no llegó al servidor no es velocidad de transferencia.
    it('una subida fallida no suma bytes', async () => {
      mockGetTreesWithPendingPhotos.mockResolvedValue([
        { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
      ]);
      const storageChain = {
        upload: jest.fn().mockResolvedValue({ error: { message: 'Upload failed' } }),
        createSignedUrl: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);

      const progresos: PhotoSyncProgress[] = [];
      const result = await uploadPendingPhotos('plantation-1', (p) => progresos.push({ ...p }));

      expect(result).toEqual({ uploaded: 0, failed: 1 });
      expect(progresos[progresos.length - 1].bytes).toBe(0);
    });

    // PostgREST no da error si el árbol no existe en el server o RLS lo oculta:
    // marcarla sincronizada perdería la foto en silencio (#482).
    it('un update de foto_url que no afecta filas cuenta como fallo y no marca la foto', async () => {
      mockGetTreesWithPendingPhotos.mockResolvedValue([
        { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
      ]);
      const update = updateQueAfecta([]);
      (mockSupabase.from as jest.Mock).mockReturnValue({ update });

      const result = await uploadPendingPhotos('plantation-1');

      expect(update.mock.results[0].value.eq.mock.results[0].value.select).toHaveBeenCalledWith('id');
      expect(mockMarkPhotoSynced).not.toHaveBeenCalled();
      expect(result).toEqual({ uploaded: 0, failed: 1 });
    });

    it('returns { uploaded: 0, failed: 0 } when no pending photos', async () => {
      mockGetTreesWithPendingPhotos.mockResolvedValue([]);

      const result = await uploadPendingPhotos('plantation-1');

      expect(result).toEqual({ uploaded: 0, failed: 0 });
      expect(mockSupabase.storage.from).not.toHaveBeenCalled();
    });

    // Sin captura por foto, conLimiteDeConcurrencia deja de tomar fotos y propaga (#502).
    describe('una foto que tira excepción', () => {
      const pendientes = [
        { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
        { id: 'tree-2', fotoUrl: 'file://document/photos/photo_2.jpg', grupoId: 'sg-1', plantacionId: 'plantation-1' },
      ];

      beforeEach(() => {
        mockGetTreesWithPendingPhotos.mockResolvedValue(pendientes);
        (mockSupabase.storage.from as jest.Mock).mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: null }) });
        // El update de foto_url afecta su fila, se lea con o sin `.select('id')`.
        const afectada = { data: [{ id: 'tree' }], error: null };
        (mockSupabase.from as jest.Mock).mockReturnValue({
          update: jest.fn(() => ({
            eq: jest.fn(() => Object.assign(Promise.resolve(afectada), { select: jest.fn().mockResolvedValue(afectada) })),
          })),
        });
      });

      it('cuenta como fallida y el resto de la tanda sigue', async () => {
        mockMarkPhotoSynced.mockImplementation(async (id: string) => {
          if (id === 'tree-1') throw new Error('SQLITE_BUSY');
        });

        const result = await uploadPendingPhotos('plantation-1');

        expect(result).toEqual({ uploaded: 1, failed: 1 });
        expect(mockMarkPhotoSynced).toHaveBeenCalledWith('tree-2');
      });

      it('una cancelación sigue cortando la tanda', async () => {
        mockMarkPhotoSynced.mockRejectedValue(new SyncCanceladoError());

        await expect(uploadPendingPhotos('plantation-1')).rejects.toThrow(SyncCanceladoError);
      });
    });
  });

  describe('downloadPhotosForPlantation — photo download', () => {
    /** Setup común de los tests que llegan a bajar una foto remota. */
    const mockearUnaFotoRemota = () => {
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 'sg-1' }]),
        }),
      }).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'tree-1', fotoUrl: 'plantations/p-1/trees/tree-1.jpg', grupoId: 'sg-1' },
          ]),
        }),
      });
      const storageChain = {
        upload: jest.fn(),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/photo.jpg' },
          error: null,
        }),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);
      return storageChain;
    };

    it('downloads remote photos using signed URLs', async () => {
      const storageChain = mockearUnaFotoRemota();

      const result = await downloadPhotosForPlantation('plantation-1');

      expect(storageChain.createSignedUrl).toHaveBeenCalledTimes(1);
      expect(result.downloaded).toBe(1);
      expect(result.failed).toBe(0);
      // La copia local queda como foto ya subida: el push no la vuelve a mandar.
      const set = (mockDb.update as jest.Mock).mock.results[0].value.set as jest.Mock;
      expect(set).toHaveBeenCalledWith({ fotoUrl: expect.stringMatching(/^file:\/\//), fotoSynced: true });
    });

    // Los bytes son para la velocidad, no para decidir si la foto llegó: un driver
    // que no informa `size` no puede convertir un éxito en una falla (#450).
    it('una foto que llega sin tamaño informado igual cuenta como descargada', async () => {
      mockearUnaFotoRemota();
      const storageChain = {
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url/x.jpg' }, error: null }),
        upload: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);

      const progresos: PhotoSyncProgress[] = [];
      const result = await downloadPhotosForPlantation('plantation-1', (p) => progresos.push({ ...p }));

      expect(result).toEqual({ downloaded: 1, failed: 0 });
      expect(progresos[progresos.length - 1].bytes).toBe(0);
    });

    it('skips trees with local file:// fotoUrl', async () => {
      // Mock db.select for groups then trees
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 'sg-1' }]),
        }),
      }).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { id: 'tree-1', fotoUrl: 'file://document/photos/photo_1.jpg', grupoId: 'sg-1' },
          ]),
        }),
      });

      const storageChain = {
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
      };
      (mockSupabase.storage.from as jest.Mock).mockReturnValue(storageChain);

      const result = await downloadPhotosForPlantation('plantation-1');

      expect(storageChain.createSignedUrl).not.toHaveBeenCalled();
      expect(result).toEqual({ downloaded: 0, failed: 0 });
    });

    it('descarga de forma idempotente: el nombre del archivo es determinístico (#452)', async () => {
      mockearUnaFotoRemota();

      await downloadPhotosForPlantation('plantation-1');

      expect(mockDownloadFileAsync).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        expect.anything(),
        { idempotent: true },
      );
    });

    it('con el archivo ya presente la descarga lo sobreescribe en vez de fallar (#452)', async () => {
      // Comportamiento real de expo-file-system: sin `idempotent` tira si el archivo existe.
      mockDownloadFileAsync.mockImplementationOnce(
        (_url: string, _dest: unknown, options?: { idempotent?: boolean }) => {
          if (!options?.idempotent) throw new Error('Destination file already exists');
          return Promise.resolve(undefined);
        },
      );
      mockearUnaFotoRemota();

      const result = await downloadPhotosForPlantation('plantation-1');

      expect(result).toEqual({ downloaded: 1, failed: 0 });
    });

    it('returns { downloaded: 0, failed: 0 } when plantation has no groups', async () => {
      (mockDb.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(whereResult([])),
        }),
      });

      const result = await downloadPhotosForPlantation('plantation-1');

      expect(result).toEqual({ downloaded: 0, failed: 0 });
    });
  });
});
