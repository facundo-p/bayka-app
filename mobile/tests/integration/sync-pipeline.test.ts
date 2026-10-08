/**
 * Push de grupos (`uploadSyncableGroups`) contra SQLite real: qué lee de la base,
 * qué manda al RPC `sync_subgroup`, qué fotos sube y qué marca al volver. Cierra
 * con el ciclo de dos dispositivos: bajar un árbol N/N, resolverlo, volver a hacer
 * pull y subirlo.
 *
 * Supabase: tablas in-memory para el pull; el RPC y Storage registran las llamadas.
 */
import Database from 'better-sqlite3';
import { conRolCacheado, conUsuarioCacheado } from '../helpers/rolCacheado';
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
jest.mock('../../src/services/PhotoService', () => ({ borrarFotosLocales: jest.fn() }));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { uploadSyncableGroups } from '../../src/services/sync/pushService';
import { pullFromServer } from '../../src/services/sync/pullService';
import { cambiarEspecie, getTreesWithPendingPhotos, updateTreeGps, updateTreePhoto } from '../../src/repositories/TreeRepository';
import { deleteGroup, type Group } from '../../src/repositories/GroupRepository';
import { conflictosDePlantacion } from '../../src/repositories/ConflictosDeSyncRepository';
import { asentarGrupo } from '../../src/services/sync/asentarGrupo';
import { conservarLaMia, descartarConflicto } from '../../src/services/ConflictosDeSyncService';
import { borrarFotosLocales } from '../../src/services/PhotoService';

const PLANTACION_ID = 'plant-1';
const PARCELA_ID = 'parc-1';
const GRUPO_ID = 'g-1';
const ROBLE = 'sp-roble';
const FOTO_LOCAL = 'file:///data/photos/t-1.jpg';
const pathEnStorage = (treeId: string) => `plantations/${PLANTACION_ID}/parcelas/${PARCELA_ID}/trees/${treeId}.jpg`;
// La versión del path es el nombre del archivo local (#795).
const FOTO_SUBIDA = pathEnStorage('t-1-t1');

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
const grupoSubido = async () => (await leerGrupo()) as Group;
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

  // #768: el server solo deja escribir en un grupo ajeno a admin y superadmin.
  it('un técnico no sube el grupo que creó otro usuario: queda pendiente', async () => {
    await mockTestDb.insert(groups).values(grupoLocal({ usuarioCreador: 'otro-tecnico', estado: 'activa' }));

    expect(await uploadSyncableGroups(PLANTACION_ID)).toEqual([]);
    expect(llamadasSyncSubgroup()).toHaveLength(0);
    expect((await leerGrupo()).pendingSync).toBe(true);
  });

  it('un admin sube el grupo ajeno que editó, con su foto', async () => {
    conRolCacheado('admin', 'user-admin-1');
    await mockTestDb.insert(groups).values(grupoLocal({ usuarioCreador: 'otro-tecnico', estado: 'activa' }));
    await mockTestDb.insert(trees).values(arbolLocal('t-1', { fotoUrl: FOTO_LOCAL }));

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(resultado.success).toBe(true);
    expect(llamadasSyncSubgroup()[0].args.p_subgroup).toMatchObject({ usuario_creador: 'otro-tecnico', estado: 'activa' });
    expect(arbolesDelPayload()[0].foto_url).toBe(FOTO_SUBIDA);
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

    expect(mockSubidas).toEqual([FOTO_SUBIDA]);
    expect(arbolesDelPayload()[0].foto_url).toBe(FOTO_SUBIDA);
    expect(await leerArbol('t-1')).toMatchObject({ fotoSynced: true, fotoUrl: FOTO_LOCAL, fotoBase: FOTO_SUBIDA });
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

    const ids = (await getTreesWithPendingPhotos(PLANTACION_ID, { userId: 'user-tecnico-1', esAdmin: false }))
      .map((t) => t.id).sort();

    expect(ids).toEqual(['t-de-grupo-al-dia', 't-pendiente']);
  });

  // #768: Storage rechaza la foto de un técnico en un grupo ajeno; la de un admin, no.
  it('un técnico no sube las de un grupo ajeno; un admin sí', async () => {
    await mockTestDb.insert(groups).values([
      grupoLocal({ pendingSync: true }),
      grupoLocal({ id: 'g-ajeno', nombre: 'Linea B', codigo: 'LB', usuarioCreador: 'otro-tecnico' }),
    ]);
    await mockTestDb.insert(trees).values([
      arbolLocal('t-propia', { fotoUrl: FOTO_LOCAL }),
      arbolLocal('t-ajena', { groupId: 'g-ajeno', fotoUrl: 'file:///data/photos/b.jpg' }),
    ]);

    const ids = async (subidor: { userId: string; esAdmin: boolean }) =>
      (await getTreesWithPendingPhotos(PLANTACION_ID, subidor)).map((t) => t.id).sort();

    expect(await ids({ userId: 'user-tecnico-1', esAdmin: false })).toEqual(['t-propia']);
    expect(await ids({ userId: 'user-admin-1', esAdmin: true })).toEqual(['t-ajena', 't-propia']);
  });
});

/** Lo que el pull necesita del server para bajar los árboles del grupo. */
function servidorConElGrupo() {
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
}

describe('N/N resuelto en otro dispositivo: pull, resolución, pull y push', () => {
  beforeEach(() => {
    servidorConElGrupo();
    serverState.trees.set('t-nn', {
      id: 't-nn', group_id: GRUPO_ID, species_id: null, posicion: 1, sub_id: 'P1LANN1',
      foto_url: pathEnStorage('t-nn'), usuario_registro: 'otro-tecnico', created_at: '2026-01-01T00:00:00',
    });
  });

  // El grupo es de otro técnico: lo resuelve un admin (#768), con la cuenta de la sesión del SDK.
  it('la especie resuelta sobrevive al pull y sube sin reenviar la foto', async () => {
    conRolCacheado('admin', 'user-tecnico-1');
    await pullFromServer(PLANTACION_ID);
    const bajado = await leerArbol('t-nn');
    expect(bajado.especieId).toBeNull();
    expect(bajado.fotoSynced).toBe(true);
    // Lo que deja la descarga de fotos: copia local de una foto que ya está en Storage.
    await mockTestDb.update(trees).set({ fotoUrl: 'file:///data/photos/t-nn.jpg' }).where(eq(trees.id, 't-nn'));

    await cambiarEspecie('t-nn', ROBLE);
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

describe('cambio de especie (#679): base local y push', () => {
  const PINO = 'sp-pino';
  const ALAMO = 'sp-alamo';
  const conserva = (especie: string) => {
    mockRespuesta.syncSubgroup = { data: { success: true, conservadas: [{ id: 't-1', species_id: especie }] }, error: null };
  };
  const conservaAlamo = () => conserva(ALAMO);
  const alamoLocal = () => mockTestDb.insert(species).values({
    id: ALAMO, codigo: 'ALA', nombre: 'Álamo', nombreCientifico: null, createdAt: '2026-01-01T00:00:00',
  });

  beforeEach(async () => {
    await mockTestDb.insert(species).values({
      id: PINO, codigo: 'PIN', nombre: 'Pino', nombreCientifico: 'Pinus', createdAt: '2026-01-01T00:00:00',
    });
    await mockTestDb.insert(groups).values(grupoLocal({ pendingSync: false }));
    await mockTestDb.insert(trees).values(arbolLocal('t-1', { posicion: 3, especieBaseId: ROBLE }));
  });

  it('cambia la especie, rearma el SubID, marca el grupo y deja la base', async () => {
    const resultado = await cambiarEspecie('t-1', PINO);

    expect(resultado).toEqual({ subId: 'P1LAPIN3' });
    const arbol = await leerArbol('t-1');
    expect(arbol).toMatchObject({ especieId: PINO, subId: 'P1LAPIN3', especieBaseId: ROBLE });
    expect((await leerGrupo()).pendingSync).toBe(true);
  });

  it('el push manda la base y, confirmado, la especie subida pasa a ser la base', async () => {
    await cambiarEspecie('t-1', PINO);

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(arbolesDelPayload()[0]).toMatchObject({ species_id: PINO, species_base_id: ROBLE });
    expect((await leerArbol('t-1')).especieBaseId).toBe(PINO);
    expect(resultado).not.toHaveProperty('conflictos');
  });

  it('un push rechazado deja la base como estaba', async () => {
    mockRespuesta.syncSubgroup = { data: { success: false, error: 'DUPLICATE_CODE' }, error: null };
    await cambiarEspecie('t-1', PINO);

    await uploadSyncableGroups(PLANTACION_ID);

    expect((await leerArbol('t-1')).especieBaseId).toBe(ROBLE);
  });

  // Gana el server: lo cambiaron en los dos lados y `sync_subgroup` se quedó con la suya.
  it('si el server conservó su especie, el árbol la adopta con su SubID y la propia queda como conflicto', async () => {
    await alamoLocal();
    await cambiarEspecie('t-1', PINO);
    conservaAlamo();

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(await leerArbol('t-1')).toMatchObject({ especieId: ALAMO, especieBaseId: ALAMO, subId: 'P1LAALA3' });
    expect(resultado).toMatchObject({ success: true, conflictos: 1 });
    expect(await conflictosDePlantacion(PLANTACION_ID)).toEqual([
      expect.objectContaining({ entidadId: 't-1', campo: 'especie', mio: PINO, servidor: ALAMO }),
    ]);
    expect((await leerGrupo()).pendingSync).toBe(true);
  });

  it('la especie conservada que falta en el catálogo local se baja antes de adoptarla', async () => {
    serverState.species.set(ALAMO, {
      id: ALAMO, codigo: 'ALA', nombre: 'Álamo', nombre_cientifico: null, created_at: '2026-01-01T00:00:00',
    });
    await cambiarEspecie('t-1', PINO);
    conservaAlamo();

    await uploadSyncableGroups(PLANTACION_ID);

    expect((await leerArbol('t-1')).especieId).toBe(ALAMO);
  });

  // Sin confirmar la base: si el grupo vuelve a subir, el server lo vuelve a devolver.
  it('sin la especie conservada en ningún catálogo, el árbol queda como está, con su base, y no se cuenta', async () => {
    await cambiarEspecie('t-1', PINO);
    conservaAlamo();

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(await leerArbol('t-1')).toMatchObject({ especieId: PINO, especieBaseId: ROBLE });
    expect(resultado).not.toHaveProperty('conflictos');
    // Sincronizado, el pull siguiente pisaría la propia sin dejar conflicto.
    expect((await leerGrupo()).pendingSync).toBe(true);
  });

  it('no pisa un árbol que cambió acá durante el push', async () => {
    await alamoLocal();
    const enviado = await leerArbol('t-1');
    await cambiarEspecie('t-1', PINO);

    const conflictos = await asentarGrupo(await grupoSubido(), [enviado], new Map(), {
      success: true, conservadas: [{ id: 't-1', species_id: ALAMO }],
    });

    expect(conflictos).toBe(0);
    expect(await leerArbol('t-1')).toMatchObject({ especieId: PINO, especieBaseId: ROBLE });
    expect((await leerGrupo()).pendingSync).toBe(true);
  });

  it('la base confirmada es la especie que viajó, no la que tiene la fila después', async () => {
    await cambiarEspecie('t-1', PINO);
    const enviado = await leerArbol('t-1');
    await cambiarEspecie('t-1', ROBLE);

    await asentarGrupo(await grupoSubido(), [enviado], new Map(), { success: true });

    expect(await leerArbol('t-1')).toMatchObject({ especieId: ROBLE, especieBaseId: PINO });
  });

  it('un N/N que el server ya resolvió: lo adopta en el push, sin aviso', async () => {
    await mockTestDb.update(trees).set({ especieId: null, especieBaseId: null, subId: 'P1LANN3' }).where(eq(trees.id, 't-1'));
    await mockTestDb.update(groups).set({ pendingSync: true }).where(eq(groups.id, GRUPO_ID));
    conserva(PINO);

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(await leerArbol('t-1')).toMatchObject({ especieId: PINO, especieBaseId: PINO, subId: 'P1LAPIN3' });
    expect(resultado).not.toHaveProperty('conflictos');
  });

  // Un grupo que llega pendiente a cada sync nunca recibe la especie por el pull.
  it('un árbol sin cambio local que el server cambió: lo adopta en el push, sin aviso', async () => {
    await mockTestDb.update(groups).set({ pendingSync: true }).where(eq(groups.id, GRUPO_ID));
    conserva(PINO);

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(arbolesDelPayload()[0]).toMatchObject({ species_id: ROBLE, species_base_id: ROBLE });
    expect(await leerArbol('t-1')).toMatchObject({ especieId: PINO, especieBaseId: PINO, subId: 'P1LAPIN3' });
    expect(resultado).not.toHaveProperty('conflictos');
  });
});

describe('pull — base del grupo (#795)', () => {
  it('un grupo al día queda con los datos del server como base', async () => {
    servidorConElGrupo();
    conRolCacheado('admin', 'user-tecnico-1');

    await pullFromServer(PLANTACION_ID);

    expect((await leerGrupo()).baseDelServidor).toEqual({ nombre: 'Linea A', codigo: 'LA', tipo: 'linea', estado: 'finalizada' });
  });
});

describe('conflictos de sincronización (#795)', () => {
  const ORIGINAL = { latitude: -34.1, longitude: -58.1, gpsAccuracy: 5, gpsCapturedAt: '2026-10-01T10:00:00' };
  const BASE_ORIGINAL = { latitudeBase: -34.1, longitudeBase: -58.1, gpsCapturedAtBase: '2026-10-01T10:00:00' };
  const MIO = { latitude: -34.3, longitude: -58.3, gpsAccuracy: 4, gpsCapturedAt: '2026-10-03T10:00:00' };
  const DEL_SERVER = { latitude: -34.2, longitude: -58.2, gps_accuracy: 3, gps_captured_at: '2026-10-02T10:00:00' };
  const PUNTO_DEL_SERVER = { latitude: -34.2, longitude: -58.2, gpsAccuracy: 3, gpsCapturedAt: '2026-10-02T10:00:00' };
  const BASE_DEL_SERVER = { latitude: -34.2, longitude: -58.2, gps_captured_at: '2026-10-02T10:00:00' };
  const FOTO_BASE = pathEnStorage('t-1-v1');
  const FOTO_DEL_SERVER = pathEnStorage('t-1-admin');
  const BASE_DEL_GRUPO = { nombre: 'Linea A', codigo: 'LA', tipo: 'linea', estado: 'finalizada' };

  const conserva = (conservados: object) => {
    mockRespuesta.syncSubgroup = {
      data: { success: true, conservadas: [], conservados: { grupo: {}, arboles: [], ...conservados } }, error: null,
    };
  };
  const conservaElArbol = (arbol: object) => conserva({ arboles: [{ id: 't-1', ...arbol }] });
  const sinConservar = () => { mockRespuesta.syncSubgroup = { data: { success: true }, error: null }; };
  const conArbol = (overrides: Partial<typeof trees.$inferInsert> = {}) => mockTestDb.insert(trees).values(arbolLocal('t-1', {
    ...ORIGINAL, ...BASE_ORIGINAL, fotoUrl: FOTO_BASE, fotoSynced: true, fotoBase: FOTO_BASE, ...overrides,
  }));
  const conflictos = () => conflictosDePlantacion(PLANTACION_ID);

  async function conConflictoDeGps() {
    await conArbol(MIO);
    conservaElArbol({ gps: DEL_SERVER });
    await uploadSyncableGroups(PLANTACION_ID);
    sinConservar();
  }

  async function conConflictoDeFoto() {
    await conArbol({ fotoUrl: FOTO_LOCAL, fotoSynced: false });
    conservaElArbol({ foto_url: FOTO_DEL_SERVER });
    await uploadSyncableGroups(PLANTACION_ID);
    sinConservar();
    (borrarFotosLocales as jest.Mock).mockClear();
  }

  async function conConflictoDeNombre() {
    await mockTestDb.update(groups).set({ nombre: 'Linea Mia' }).where(eq(groups.id, GRUPO_ID));
    conserva({ grupo: { nombre: 'Linea Admin' } });
    await uploadSyncableGroups(PLANTACION_ID);
    sinConservar();
  }

  beforeEach(async () => {
    (borrarFotosLocales as jest.Mock).mockClear();
    await mockTestDb.insert(groups).values(grupoLocal({ baseDelServidor: BASE_DEL_GRUPO }));
  });

  describe('push', () => {
    it('manda las bases del grupo y de cada árbol, y confirmado pasan a ser lo que subió', async () => {
      await conArbol(MIO);

      await uploadSyncableGroups(PLANTACION_ID);

      expect(llamadasSyncSubgroup()[0].args.p_subgroup.base).toEqual(BASE_DEL_GRUPO);
      expect(arbolesDelPayload()[0]).toMatchObject({
        latitude: -34.3,
        gps_base: { latitude: -34.1, longitude: -58.1, gps_captured_at: '2026-10-01T10:00:00' },
        foto_url: FOTO_BASE,
        foto_base: FOTO_BASE,
      });
      expect(await leerArbol('t-1')).toMatchObject({ latitudeBase: -34.3, gpsCapturedAtBase: '2026-10-03T10:00:00' });
      expect((await leerGrupo()).pendingSync).toBe(false);
    });

    it('GPS cambiado en los dos lados: adopta el del server y guarda el propio como conflicto', async () => {
      await conArbol(MIO);
      conservaElArbol({ gps: DEL_SERVER });

      const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

      expect(resultado).toMatchObject({ success: true, conflictos: 1 });
      expect(await leerArbol('t-1')).toMatchObject({
        ...PUNTO_DEL_SERVER, latitudeBase: -34.2, longitudeBase: -58.2, gpsCapturedAtBase: '2026-10-02T10:00:00',
      });
      expect(await conflictos()).toEqual([expect.objectContaining({
        entidadId: 't-1', campo: 'gps', grupoId: GRUPO_ID, plantacionId: PLANTACION_ID, mio: MIO, servidor: PUNTO_DEL_SERVER,
      })]);
      expect((await leerGrupo()).pendingSync).toBe(true);
    });

    it('GPS cambiado solo en el server: lo adopta sin conflicto y el grupo queda al día', async () => {
      await conArbol();
      conservaElArbol({ gps: DEL_SERVER });

      const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

      expect(resultado).not.toHaveProperty('conflictos');
      expect(await leerArbol('t-1')).toMatchObject(PUNTO_DEL_SERVER);
      expect(await conflictos()).toEqual([]);
      expect((await leerGrupo()).pendingSync).toBe(false);
    });

    it('foto propia sin subir contra otra del server: queda la del server y la propia en el conflicto, sin borrarla', async () => {
      await conArbol({ fotoUrl: FOTO_LOCAL, fotoSynced: false });
      conservaElArbol({ foto_url: FOTO_DEL_SERVER });

      await uploadSyncableGroups(PLANTACION_ID);

      expect(mockSubidas).toEqual([FOTO_SUBIDA]);
      expect(await leerArbol('t-1')).toMatchObject({ fotoUrl: FOTO_DEL_SERVER, fotoSynced: true, fotoBase: FOTO_DEL_SERVER });
      expect(await conflictos()).toEqual([
        expect.objectContaining({ campo: 'foto', mio: FOTO_LOCAL, servidor: FOTO_DEL_SERVER }),
      ]);
      expect(borrarFotosLocales).not.toHaveBeenCalledWith(expect.arrayContaining([FOTO_LOCAL]));
    });

    it('copia local de una foto que el server reemplazó: adopta la nueva y borra la copia', async () => {
      await conArbol({ fotoUrl: FOTO_LOCAL, fotoSynced: true });
      conservaElArbol({ foto_url: FOTO_DEL_SERVER });

      const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

      expect(resultado).not.toHaveProperty('conflictos');
      expect(await leerArbol('t-1')).toMatchObject({ fotoUrl: FOTO_DEL_SERVER, fotoBase: FOTO_DEL_SERVER });
      expect(borrarFotosLocales).toHaveBeenCalledWith([FOTO_LOCAL]);
    });

    it('nombre cambiado en los dos lados: adopta el del server, guarda el propio y actualiza la base', async () => {
      await conConflictoDeNombre();

      expect(await leerGrupo()).toMatchObject({
        nombre: 'Linea Admin', baseDelServidor: { ...BASE_DEL_GRUPO, nombre: 'Linea Admin' }, pendingSync: true,
      });
      expect(await conflictos()).toEqual([
        expect.objectContaining({ entidadId: GRUPO_ID, campo: 'nombre', mio: 'Linea Mia', servidor: 'Linea Admin' }),
      ]);
    });

    it('un nombre del server que ya usa otro grupo local no se adopta: el grupo sigue pendiente', async () => {
      await mockTestDb.insert(groups).values(grupoLocal({ id: 'g-otro', nombre: 'Linea Admin', codigo: 'LO', pendingSync: false }));
      await conArbol(MIO);

      await conConflictoDeNombre();

      expect(await leerGrupo()).toMatchObject({ nombre: 'Linea Mia', pendingSync: true });
      expect(await conflictos()).toEqual([]);
      // El resto del grupo se asienta igual.
      expect((await leerArbol('t-1')).latitudeBase).toBe(-34.3);
    });

    it('código cambiado solo en el server: lo adopta y rearma los SubID', async () => {
      await mockTestDb.insert(trees).values(arbolLocal('t-1', { subId: 'P1LAROB1' }));
      conserva({ grupo: { codigo: 'LS' } });

      await uploadSyncableGroups(PLANTACION_ID);

      expect(await leerGrupo()).toMatchObject({ codigo: 'LS', pendingSync: false });
      expect((await leerArbol('t-1')).subId).toBe('P1LSROB1');
    });

    it('con un conflicto sin decidir, la sync siguiente sube lo del server y el grupo sigue pendiente', async () => {
      await conConflictoDeGps();

      await uploadSyncableGroups(PLANTACION_ID);

      expect(arbolesDelPayload()[0]).toMatchObject({ latitude: -34.2, gps_base: BASE_DEL_SERVER });
      expect(await conflictos()).toHaveLength(1);
      expect((await leerGrupo()).pendingSync).toBe(true);
    });

    it('un cambio propio que el server acepta deja atrás el conflicto anterior', async () => {
      await conConflictoDeGps();
      await updateTreeGps('t-1', { latitude: -34.5, longitude: -58.5, gpsAccuracy: 1, gpsCapturedAt: '2026-10-05T10:00:00' });

      await uploadSyncableGroups(PLANTACION_ID);

      expect(arbolesDelPayload()[0].gps_base).toEqual(BASE_DEL_SERVER);
      expect(await conflictos()).toEqual([]);
      expect((await leerGrupo()).pendingSync).toBe(false);
    });
  });

  describe('resolver', () => {
    it('conservar la mía vuelve a aplicar el punto propio, y el push siguiente lo sube con la base del server', async () => {
      await conConflictoDeGps();

      expect(await conservarLaMia('t-1', 'gps')).toEqual({ success: true });

      expect(await leerArbol('t-1')).toMatchObject(MIO);
      expect(await conflictos()).toEqual([]);
      await uploadSyncableGroups(PLANTACION_ID);
      expect(arbolesDelPayload()[0]).toMatchObject({ latitude: -34.3, gps_base: BASE_DEL_SERVER });
      expect((await leerGrupo()).pendingSync).toBe(false);
    });

    it('conservar la mía en la foto: la propia vuelve al árbol para subirse y no se borra', async () => {
      await conConflictoDeFoto();

      expect(await conservarLaMia('t-1', 'foto')).toEqual({ success: true });

      expect(await leerArbol('t-1')).toMatchObject({ fotoUrl: FOTO_LOCAL, fotoSynced: false, fotoBase: FOTO_DEL_SERVER });
      expect(borrarFotosLocales).not.toHaveBeenCalledWith(expect.arrayContaining([FOTO_LOCAL]));
      expect(await conflictos()).toEqual([]);
    });

    it('descartar la foto: queda la del server y se borra la propia', async () => {
      await conConflictoDeFoto();

      expect(await descartarConflicto('t-1', 'foto')).toEqual({ success: true });

      expect(await leerArbol('t-1')).toMatchObject({ fotoUrl: FOTO_DEL_SERVER });
      expect(borrarFotosLocales).toHaveBeenCalledWith([FOTO_LOCAL]);
      expect(await conflictos()).toEqual([]);
    });

    // Conservar la mía cortado entre la edición y el quitar: la foto ya es del árbol.
    it('descartar no borra una foto propia que el árbol ya usa', async () => {
      await conConflictoDeFoto();
      await updateTreePhoto('t-1', FOTO_LOCAL);

      expect(await descartarConflicto('t-1', 'foto')).toEqual({ success: true });

      expect(borrarFotosLocales).not.toHaveBeenCalledWith(expect.arrayContaining([FOTO_LOCAL]));
      expect(await conflictos()).toEqual([]);
    });

    it('conservar la mía en el nombre lo vuelve a aplicar como una edición', async () => {
      await conConflictoDeNombre();

      expect(await conservarLaMia(GRUPO_ID, 'nombre')).toEqual({ success: true });

      expect(await leerGrupo()).toMatchObject({ nombre: 'Linea Mia', pendingSync: true });
      expect(await conflictos()).toEqual([]);
    });

    it('un conflicto que ya no está no se resuelve', async () => {
      expect(await conservarLaMia('t-x', 'gps')).toEqual({ success: false, error: 'conflicto_inexistente' });
      expect(await descartarConflicto('t-x', 'gps')).toEqual({ success: false, error: 'conflicto_inexistente' });
    });

    it('borrar el grupo se lleva sus conflictos y la foto propia', async () => {
      await conConflictoDeFoto();

      await deleteGroup(GRUPO_ID);

      expect(await conflictos()).toEqual([]);
      expect(borrarFotosLocales).toHaveBeenCalledWith(expect.arrayContaining([FOTO_LOCAL]));
    });
  });
});

// El guard de sesión exige que el usuario cacheado sea el de la sesión (#658).
beforeEach(() => conUsuarioCacheado('user-tecnico-1'));
