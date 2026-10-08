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
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { uploadSyncableGroups } from '../../src/services/sync/pushService';
import { pullFromServer } from '../../src/services/sync/pullService';
import { cambiarEspecie, confirmarEspeciesSubidas, getTreesWithPendingPhotos } from '../../src/repositories/TreeRepository';
import { asentarEspeciesSubidas } from '../../src/services/sync/especiesConservadas';

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
    expect(arbolesDelPayload()[0].foto_url).toBe(pathEnStorage('t-1'));
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
    expect(resultado).not.toHaveProperty('especiesDelServidor');
  });

  it('un push rechazado deja la base como estaba', async () => {
    mockRespuesta.syncSubgroup = { data: { success: false, error: 'DUPLICATE_CODE' }, error: null };
    await cambiarEspecie('t-1', PINO);

    await uploadSyncableGroups(PLANTACION_ID);

    expect((await leerArbol('t-1')).especieBaseId).toBe(ROBLE);
  });

  // Gana el server: lo cambiaron en los dos lados y `sync_subgroup` se quedó con la suya.
  it('si el server conservó su especie, el árbol la adopta con su SubID y el resultado lo cuenta', async () => {
    await alamoLocal();
    await cambiarEspecie('t-1', PINO);
    conservaAlamo();

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(await leerArbol('t-1')).toMatchObject({ especieId: ALAMO, especieBaseId: ALAMO, subId: 'P1LAALA3' });
    expect(resultado).toMatchObject({ success: true, especiesDelServidor: 1 });
    expect((await leerGrupo()).pendingSync).toBe(false);
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
    expect(resultado).not.toHaveProperty('especiesDelServidor');
  });

  it('no pisa un árbol que cambió acá durante el push', async () => {
    await alamoLocal();
    await cambiarEspecie('t-1', PINO);

    const avisos = await asentarEspeciesSubidas(
      [{ id: 't-1', especieId: ROBLE, especieBaseId: ROBLE }],
      { conservadas: [{ id: 't-1', species_id: ALAMO }] },
    );

    expect(avisos).toBe(0);
    expect(await leerArbol('t-1')).toMatchObject({ especieId: PINO, especieBaseId: ROBLE });
  });

  it('la base confirmada es la especie que viajó, no la que tiene la fila después', async () => {
    await cambiarEspecie('t-1', PINO);
    await cambiarEspecie('t-1', ROBLE);

    await confirmarEspeciesSubidas([{ id: 't-1', especieId: PINO, especieBaseId: ROBLE }]);

    expect(await leerArbol('t-1')).toMatchObject({ especieId: ROBLE, especieBaseId: PINO });
  });

  it('un N/N que el server ya resolvió: lo adopta en el push, sin aviso', async () => {
    await mockTestDb.update(trees).set({ especieId: null, especieBaseId: null, subId: 'P1LANN3' }).where(eq(trees.id, 't-1'));
    await mockTestDb.update(groups).set({ pendingSync: true }).where(eq(groups.id, GRUPO_ID));
    conserva(PINO);

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(await leerArbol('t-1')).toMatchObject({ especieId: PINO, especieBaseId: PINO, subId: 'P1LAPIN3' });
    expect(resultado).not.toHaveProperty('especiesDelServidor');
  });

  // Un grupo que llega pendiente a cada sync nunca recibe la especie por el pull.
  it('un árbol sin cambio local que el server cambió: lo adopta en el push, sin aviso', async () => {
    await mockTestDb.update(groups).set({ pendingSync: true }).where(eq(groups.id, GRUPO_ID));
    conserva(PINO);

    const [resultado] = await uploadSyncableGroups(PLANTACION_ID);

    expect(arbolesDelPayload()[0]).toMatchObject({ species_id: ROBLE, species_base_id: ROBLE });
    expect(await leerArbol('t-1')).toMatchObject({ especieId: PINO, especieBaseId: PINO, subId: 'P1LAPIN3' });
    expect(resultado).not.toHaveProperty('especiesDelServidor');
  });
});

// El guard de sesión exige que el usuario cacheado sea el de la sesión (#658).
beforeEach(() => conUsuarioCacheado('user-tecnico-1'));
