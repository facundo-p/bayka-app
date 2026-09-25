/**
 * Push de grupos (`uploadSyncableGroups`) contra SQLite real: qué lee de la base,
 * qué manda al RPC `sync_subgroup`, qué fotos sube y qué marca al volver. Cierra
 * con el ciclo de dos dispositivos: bajar un árbol N/N, resolverlo, volver a hacer
 * pull y subirlo.
 *
 * Supabase: tablas in-memory para el pull; el RPC y Storage registran las llamadas.
 */
import Database from 'better-sqlite3';
import { conUsuarioCacheado } from '../helpers/rolCacheado';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestParcela, createTestPlantation } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';

const mockServerState: Record<string, Map<string, any>> = {
  plantations: new Map(),
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
  species: new Map(),
};
const serverState = mockServerState;
const mockRpcCalls: { fn: string; args: any }[] = [];
const mockSubidas: string[] = [];
const mockRespuesta = { syncSubgroup: { data: { success: true } as any, error: null as any } };

jest.mock('../../src/supabase/client', () => {
  const builder = (tabla: string) => {
    const filtros: { col: string; op: string; value: any }[] = [];
    const filtrar = () =>
      Array.from(mockServerState[tabla]?.values() ?? []).filter((fila: any) =>
        filtros.every((f) =>
          f.op === 'eq' ? fila[f.col] === f.value : Array.isArray(f.value) && f.value.includes(fila[f.col]),
        ),
      );
    const api: any = {
      select() { return api; },
      eq(col: string, value: any) { filtros.push({ col, op: 'eq', value }); return api; },
      in(col: string, value: any[]) { filtros.push({ col, op: 'in', value }); return api; },
      single() {
        const filas = filtrar();
        return Promise.resolve({ data: filas[0] ?? null, error: filas[0] ? null : { code: 'PGRST116' } });
      },
      then(resolver: any) {
        return Promise.resolve({ data: filtrar(), error: null }).then(resolver);
      },
    };
    return api;
  };

  return {
    supabase: {
      from: (tabla: string) => ({ select: () => builder(tabla) }),
      rpc(fn: string, args: any) {
        mockRpcCalls.push({ fn, args });
        if (fn === 'sync_subgroup') return Promise.resolve(mockRespuesta.syncSubgroup);
        // Server sin `estado_remoto_plantaciones`: el acceso sale de la membresía (#478).
        return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
      },
      storage: {
        from: () => ({
          upload(path: string) {
            mockSubidas.push(path);
            return Promise.resolve({ error: null });
          },
        }),
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-tecnico-1' } } } }),
        getUser: () => Promise.resolve({ data: { user: { id: 'user-tecnico-1' } } }),
      },
    },
  };
});

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  })),
}));

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
  get sqlite() {
    return mockSqliteDeIntegracion;
  },
}));

jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { uploadSyncableGroups } from '../../src/services/sync/pushService';
import { pullFromServer } from '../../src/services/sync/pullService';
import { resolveNNTree, getTreesWithPendingPhotos } from '../../src/repositories/TreeRepository';

const PLANTACION_ID = 'plant-1';
const PARCELA_ID = 'parc-1';
const GRUPO_ID = 'g-1';
const ROBLE = 'sp-roble';
const FOTO_LOCAL = 'file:///data/photos/t-1.jpg';
const pathEnStorage = (treeId: string) => `plantations/${PLANTACION_ID}/parcelas/${PARCELA_ID}/trees/${treeId}.jpg`;

const grupoLocal = (overrides: Partial<typeof groups.$inferInsert> = {}) => ({
  id: GRUPO_ID, plantacionId: PLANTACION_ID, parcelaId: PARCELA_ID, nombre: 'Linea A', codigo: 'LA',
  tipo: 'linea', estado: 'finalizada', usuarioCreador: 'user-tecnico-1', createdAt: '2026-01-01T00:00:00',
  pendingSync: true, ...overrides,
});

const arbolLocal = (id: string, overrides: Partial<typeof trees.$inferInsert> = {}) => ({
  id, groupId: GRUPO_ID, especieId: ROBLE, posicion: 1, subId: `P1LAROB1-${id}`, fotoUrl: null,
  fotoSynced: false, usuarioRegistro: 'user-tecnico-1', createdAt: '2026-01-01T00:00:00', ...overrides,
});

const llamadasSyncSubgroup = () => mockRpcCalls.filter((c) => c.fn === 'sync_subgroup');
const arbolesDelPayload = () => llamadasSyncSubgroup().at(-1)!.args.p_trees as any[];
const leerGrupo = async () => (await mockTestDb.select().from(groups).where(eq(groups.id, GRUPO_ID)))[0];
const leerArbol = async (id: string) => (await mockTestDb.select().from(trees).where(eq(trees.id, id)))[0];

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();
  mockRpcCalls.length = 0;
  mockSubidas.length = 0;
  mockRespuesta.syncSubgroup = { data: { success: true }, error: null };

  await vaciarTablas(mockTestDb);
  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION_ID }));
  await mockTestDb.insert(species).values({
    id: ROBLE, codigo: 'ROB', nombre: 'Roble', nombreCientifico: null, createdAt: '2026-01-01T00:00:00',
  });
  // Parcela ya subida: si no, el grupo se reporta PARCELA_PENDING y no se sube.
  await mockTestDb.insert(parcelas).values(createTestParcela({ id: PARCELA_ID, plantacionId: PLANTACION_ID }));
});

describe('push de grupos — lo que lee de la base y manda al RPC', () => {
  it('sube el grupo pendiente con sus árboles y lo deja al día sin tocar su estado', async () => {
    await mockTestDb.insert(groups).values(grupoLocal());
    await mockTestDb.insert(trees).values([
      arbolLocal('t-1'),
      arbolLocal('t-nn', { especieId: null, posicion: 2, subId: 'P1LANN2' }),
    ]);

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(resultado).toMatchObject({ success: true, groupId: GRUPO_ID });
    const payload = arbolesDelPayload();
    expect(payload.map((t) => t.id).sort()).toEqual(['t-1', 't-nn']);
    // N/N viaja como null explícito, no undefined: el server lo espera así.
    const nn = payload.find((t) => t.id === 't-nn');
    expect(nn).toHaveProperty('species_id', null);
    expect(nn.sub_id).toBe('P1LANN2');

    const grupo = await leerGrupo();
    expect(grupo.pendingSync).toBe(false);
    expect(grupo.estado).toBe('finalizada');
    expect(await mockTestDb.select().from(trees).where(eq(trees.groupId, GRUPO_ID))).toHaveLength(2);
  });

  it('sube también el grupo que creó otro usuario', async () => {
    await mockTestDb.insert(groups).values(grupoLocal({ usuarioCreador: 'otro-tecnico', estado: 'activa' }));

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(resultado.success).toBe(true);
    expect(llamadasSyncSubgroup()[0].args.p_subgroup).toMatchObject({ usuario_creador: 'otro-tecnico', estado: 'activa' });
  });

  it('un grupo sin cambios pendientes no se sube', async () => {
    await mockTestDb.insert(groups).values(grupoLocal({ pendingSync: false }));

    expect(await uploadSyncableGroups(PLANTACION_ID)).toEqual([]);
    expect(llamadasSyncSubgroup()).toHaveLength(0);
  });

  it('RPC rechazado: el grupo y la foto quedan pendientes para el reintento', async () => {
    mockRespuesta.syncSubgroup = { data: { success: false, error: 'DUPLICATE_CODE' }, error: null };
    await mockTestDb.insert(groups).values(grupoLocal());
    await mockTestDb.insert(trees).values(arbolLocal('t-1', { fotoUrl: FOTO_LOCAL }));

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(resultado).toMatchObject({ success: false, error: 'DUPLICATE_CODE' });
    expect((await leerGrupo()).pendingSync).toBe(true);
    expect((await leerArbol('t-1')).fotoSynced).toBe(false);
  });
});

describe('push de grupos — fotos', () => {
  it('una foto pendiente se sube a Storage, viaja con su path y queda marcada', async () => {
    await mockTestDb.insert(groups).values(grupoLocal());
    await mockTestDb.insert(trees).values(arbolLocal('t-1', { fotoUrl: FOTO_LOCAL }));

    await uploadSyncableGroups(PLANTACION_ID);

    expect(mockSubidas).toEqual([pathEnStorage('t-1')]);
    expect(arbolesDelPayload()[0].foto_url).toBe(pathEnStorage('t-1'));
    const arbol = await leerArbol('t-1');
    expect(arbol.fotoSynced).toBe(true);
    expect(arbol.fotoUrl).toBe(FOTO_LOCAL);
  });

  // Foto bajada de otro dispositivo, o ya subida en un push anterior: el server ya la tiene.
  it('una foto ya subida no se resube y el file:// local no llega al server', async () => {
    await mockTestDb.insert(groups).values(grupoLocal());
    await mockTestDb.insert(trees).values(arbolLocal('t-1', { fotoUrl: FOTO_LOCAL, fotoSynced: true }));

    await uploadSyncableGroups(PLANTACION_ID);

    expect(mockSubidas).toEqual([]);
    expect(arbolesDelPayload()[0].foto_url).toBeNull();
  });

  it('un path de Storage todavía sin bajar viaja tal cual', async () => {
    await mockTestDb.insert(groups).values(grupoLocal());
    await mockTestDb.insert(trees).values(arbolLocal('t-1', { fotoUrl: pathEnStorage('t-1'), fotoSynced: true }));

    await uploadSyncableGroups(PLANTACION_ID);

    expect(mockSubidas).toEqual([]);
    expect(arbolesDelPayload()[0].foto_url).toBe(pathEnStorage('t-1'));
  });
});

describe('fotos pendientes que sube el paso de fotos sueltas', () => {
  it('solo las locales sin subir, de cualquier grupo de la plantación, esté o no pendiente', async () => {
    await mockTestDb.insert(groups).values([
      grupoLocal({ pendingSync: true }),
      grupoLocal({ id: 'g-al-dia', nombre: 'Linea B', codigo: 'LB', pendingSync: false }),
    ]);
    await mockTestDb.insert(trees).values([
      arbolLocal('t-pendiente', { fotoUrl: FOTO_LOCAL }),
      arbolLocal('t-de-grupo-al-dia', { groupId: 'g-al-dia', fotoUrl: 'file:///data/photos/b.jpg' }),
      arbolLocal('t-ya-subida', { fotoUrl: 'file:///data/photos/c.jpg', fotoSynced: true }),
      arbolLocal('t-remota', { fotoUrl: pathEnStorage('t-remota') }),
      arbolLocal('t-sin-foto'),
    ]);

    const ids = (await getTreesWithPendingPhotos(PLANTACION_ID)).map((t) => t.id).sort();

    expect(ids).toEqual(['t-de-grupo-al-dia', 't-pendiente']);
  });
});

describe('N/N resuelto en otro dispositivo: pull, resolución, pull y push', () => {
  beforeEach(() => {
    serverState.plantations.set(PLANTACION_ID, {
      id: PLANTACION_ID, lugar: 'Campo Norte', periodo: '2026-otono', estado: 'activa',
      creado_por: 'user-admin-1', created_at: '2026-01-01T00:00:00', visible_in_app: true,
    });
    serverState.plantation_users.set('pu-1', {
      plantation_id: PLANTACION_ID, user_id: 'user-tecnico-1', rol_en_plantacion: 'tecnico', assigned_at: '2026-01-01T00:00:00',
    });
    serverState.parcelas.set(PARCELA_ID, {
      id: PARCELA_ID, plantation_id: PLANTACION_ID, nombre: 'Parcela 1', codigo: 'P1', descripcion: null,
      created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00', deleted_at: null,
    });
    serverState.groups.set(GRUPO_ID, {
      id: GRUPO_ID, plantation_id: PLANTACION_ID, parcela_id: PARCELA_ID, nombre: 'Linea A', codigo: 'LA',
      tipo: 'linea', estado: 'finalizada', usuario_creador: 'otro-tecnico', created_at: '2026-01-01T00:00:00',
    });
    serverState.trees.set('t-nn', {
      id: 't-nn', group_id: GRUPO_ID, species_id: null, posicion: 1, sub_id: 'P1LANN1',
      foto_url: pathEnStorage('t-nn'), usuario_registro: 'otro-tecnico', created_at: '2026-01-01T00:00:00',
    });
  });

  it('la especie resuelta sobrevive al pull y sube sin reenviar la foto', async () => {
    await pullFromServer(PLANTACION_ID);
    const bajado = await leerArbol('t-nn');
    expect(bajado.especieId).toBeNull();
    expect(bajado.fotoSynced).toBe(true);
    // Lo que deja la descarga de fotos: copia local de una foto que ya está en Storage.
    await mockTestDb.update(trees).set({ fotoUrl: 'file:///data/photos/t-nn.jpg' }).where(eq(trees.id, 't-nn'));

    await resolveNNTree('t-nn', ROBLE, 'LA');
    await pullFromServer(PLANTACION_ID);

    const resuelto = await leerArbol('t-nn');
    expect(resuelto.especieId).toBe(ROBLE);
    expect(resuelto.subId).not.toBe('P1LANN1');
    expect((await leerGrupo()).pendingSync).toBe(true);

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(resultado.success).toBe(true);
    const [arbol] = arbolesDelPayload();
    expect(arbol).toMatchObject({ species_id: ROBLE, sub_id: resuelto.subId, foto_url: null });
    expect(mockSubidas).toEqual([]);
    expect((await leerGrupo()).pendingSync).toBe(false);
  });
});

// El guard de sesión exige que el usuario cacheado sea el de la sesión (#658).
beforeEach(() => conUsuarioCacheado('user-tecnico-1'));
