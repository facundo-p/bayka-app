/**
 * Integration tests de las fases del pull que pasaron a escribir en lotes (#449),
 * contra SQLite real: el upsert multi-fila, la especie del server que se adopta y
 * el guard de parcela obligatoria de los grupos.
 *
 * Mock de Supabase: estado in-memory por tabla.
 */
import Database from 'better-sqlite3';
import { conUsuarioCacheado } from '../helpers/rolCacheado';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species, plantationSpecies } from '../../src/database/schema';

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
/** Tablas cuya lectura devuelve `{ error }`, como un server que falla a mitad del pull. */
const mockTablasConError = new Set<string>();

jest.mock('../../src/supabase/client', () => {
  const filtrar = (tabla: string, filtros: { col: string; op: string; value: any }[]) =>
    Array.from(mockServerState[tabla]?.values() ?? []).filter((fila: any) =>
      filtros.every((f) =>
        f.op === 'eq' ? fila[f.col] === f.value : Array.isArray(f.value) && f.value.includes(fila[f.col]),
      ),
    );

  const builder = (tabla: string) => {
    const filtros: { col: string; op: string; value: any }[] = [];
    const api: any = {
      select() { return api; },
      eq(col: string, value: any) { filtros.push({ col, op: 'eq', value }); return api; },
      in(col: string, value: any[]) { filtros.push({ col, op: 'in', value }); return api; },
      single() {
        const filas = filtrar(tabla, filtros);
        return Promise.resolve({ data: filas[0] ?? null, error: filas[0] ? null : { code: 'PGRST116' } });
      },
      then(resolver: any) {
        const respuesta = mockTablasConError.has(tabla)
          ? { data: null, error: { message: 'falla simulada' } }
          : { data: filtrar(tabla, filtros), error: null };
        return Promise.resolve(respuesta).then(resolver);
      },
    };
    return api;
  };

  return {
    supabase: {
      from: (tabla: string) => ({ select: () => builder(tabla) }),
      // Server sin `estado_remoto_plantaciones`: el acceso sale de la membresía (#478).
      rpc: () => Promise.resolve({ data: null, error: { code: 'PGRST202' } }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-tecnico-1' } } } }),
      },
    },
  };
});

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

import { pullFromServer } from '../../src/services/sync/pullService';

const PLANTACION_ID = 'plant-1';
const GRUPO_ID = 'g-1';
const ROBLE = 'sp-roble';
const PINO = 'sp-pino';
const ALAMO = 'sp-alamo';

const especieDelServer = (id: string, codigo: string, nombre: string) => ({
  id, codigo, nombre, nombre_cientifico: null, created_at: '2026-01-01T00:00:00',
});

/** SQL efectivamente ejecutado, para contar statements. Drizzle cachea el `prepare`, así que se instrumenta la ejecución. */
function registrarSql(conexion: InstanceType<typeof Database>): string[] {
  const ejecutadas: string[] = [];
  const prepareOriginal = conexion.prepare.bind(conexion);
  (conexion as any).prepare = (sentencia: string) => {
    const stmt: any = prepareOriginal(sentencia);
    for (const metodo of ['all', 'get', 'run'] as const) {
      const original = stmt[metodo].bind(stmt);
      stmt[metodo] = (...args: any[]) => {
        ejecutadas.push(sentencia);
        return original(...args);
      };
    }
    return stmt;
  };
  return ejecutadas;
}

const arbolDelServer = (id: string, speciesId: string | null) => ({
  id,
  group_id: GRUPO_ID,
  species_id: speciesId,
  posicion: 1,
  sub_id: `${id}-${speciesId ?? 'NN'}`,
  foto_url: null,
  usuario_registro: 'user-tecnico-1',
  created_at: '2026-01-01T00:00:00',
});

const arbolLocal = (id: string, especieId: string | null) => ({
  id,
  groupId: GRUPO_ID,
  especieId,
  posicion: 1,
  subId: `${id}-sub`,
  fotoUrl: null,
  fotoSynced: false,
  usuarioRegistro: 'user-tecnico-1',
  createdAt: '2026-01-01T00:00:00',
});

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();
  mockTablasConError.clear();

  await vaciarTablas(mockTestDb);

  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION_ID, lugar: 'Campo', periodo: '2026' }));
  await mockTestDb.insert(species).values([
    { id: ROBLE, codigo: 'ROB', nombre: 'Roble', nombreCientifico: null, createdAt: '2026-01-01T00:00:00' },
    { id: PINO, codigo: 'PIN', nombre: 'Pino', nombreCientifico: null, createdAt: '2026-01-01T00:00:00' },
  ]);
  await mockTestDb.insert(parcelas).values({
    id: 'parc-1', plantacionId: PLANTACION_ID, nombre: 'Norte', codigo: 'P1', descripcion: null,
    pendingSync: false, createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', deletedAt: null,
  });
  await mockTestDb.insert(groups).values({
    id: GRUPO_ID, plantacionId: PLANTACION_ID, parcelaId: 'parc-1', nombre: 'Linea A', codigo: 'LA',
    tipo: 'linea', estado: 'activa', usuarioCreador: 'user-tecnico-1', createdAt: '2026-01-01T00:00:00', pendingSync: false,
  });

  serverState.plantations.set(PLANTACION_ID, {
    id: PLANTACION_ID, lugar: 'Campo', periodo: '2026', estado: 'activa',
    creado_por: 'admin-1', created_at: '2026-01-01T00:00:00', visible_in_app: true,
  });
  serverState.plantation_users.set('user-tecnico-1', { plantation_id: PLANTACION_ID, user_id: 'user-tecnico-1', rol_en_plantacion: 'tecnico', assigned_at: '2026-01-01T00:00:00' });
  serverState.parcelas.set('parc-1', {
    id: 'parc-1', plantation_id: PLANTACION_ID, nombre: 'Norte', codigo: 'P1', descripcion: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00', deleted_at: null,
  });
  serverState.groups.set(GRUPO_ID, {
    id: GRUPO_ID, plantation_id: PLANTACION_ID, parcela_id: 'parc-1', nombre: 'Linea A', codigo: 'LA',
    tipo: 'linea', estado: 'activa', usuario_creador: 'user-tecnico-1', created_at: '2026-01-01T00:00:00',
  });
});

const leerArbol = async (id: string) => (await mockTestDb.select().from(trees).where(eq(trees.id, id)))[0];

describe('pull de árboles — especie (#679)', () => {
  it('descarga fresh: inserta todos los árboles del server con su especie como base', async () => {
    serverState.trees.set('t1', arbolDelServer('t1', ROBLE));
    serverState.trees.set('t2', arbolDelServer('t2', PINO));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t1')).especieId).toBe(ROBLE);
    expect((await leerArbol('t1')).especieBaseId).toBe(ROBLE);
    expect((await leerArbol('t2')).especieId).toBe(PINO);
  });

  it('grupo sin cambios locales: adopta la especie del server, la base y su SubID', async () => {
    await mockTestDb.insert(trees).values({ ...arbolLocal('t1', ROBLE), especieBaseId: ROBLE });
    serverState.trees.set('t1', arbolDelServer('t1', PINO));

    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t1')).toMatchObject({
      especieId: PINO, especieBaseId: PINO, subId: arbolDelServer('t1', PINO).sub_id,
    });
  });

  it('al adoptar la especie, el SubID usa el código de parcela local que todavía no subió', async () => {
    await mockTestDb.update(parcelas).set({ codigo: 'P9', pendingSync: true }).where(eq(parcelas.id, 'parc-1'));
    await mockTestDb.insert(trees).values({ ...arbolLocal('t1', ROBLE), especieBaseId: ROBLE });
    serverState.trees.set('t1', { ...arbolDelServer('t1', PINO), sub_id: 'P1LAPIN1' });

    await pullFromServer(PLANTACION_ID);

    const fila = await leerArbol('t1');
    expect(fila.especieId).toBe(PINO);
    expect(fila.subId).toBe(`P9LAPIN${arbolDelServer('t1', PINO).posicion}`);
  });

  it('especie del server que el catálogo local no tiene: la baja y la adopta', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', ROBLE));
    serverState.species.set(ALAMO, especieDelServer(ALAMO, 'ALA', 'Álamo'));
    serverState.trees.set('t1', arbolDelServer('t1', ALAMO));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t1')).especieId).toBe(ALAMO);
  });

  // Escribirla dejaría el árbol apuntando a una especie inexistente.
  it('especie que ni el server devuelve: el árbol queda como estaba', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', ROBLE));
    serverState.trees.set('t1', arbolDelServer('t1', 'sp-que-no-existe'));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t1')).especieId).toBe(ROBLE);
  });

  it('misma especie en ambos lados: conserva el SubID local', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', ROBLE));
    serverState.trees.set('t1', arbolDelServer('t1', ROBLE));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t1')).subId).toBe('t1-sub');
  });

  it('sin especie local: adopta la del server con su SubID', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', null));
    serverState.trees.set('t1', arbolDelServer('t1', PINO));

    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t1')).toMatchObject({ especieId: PINO, subId: `t1-${PINO}` });
  });

  it('server sin especie: un N/N no pisa la especie local', async () => {
    await mockTestDb.insert(trees).values({ ...arbolLocal('t1', ROBLE), especieBaseId: ROBLE });
    serverState.trees.set('t1', arbolDelServer('t1', null));

    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t1')).toMatchObject({ especieId: ROBLE, especieBaseId: ROBLE });
  });

  // El push lo resuelve: si el server también la cambió, gana el server.
  it('grupo con cambios sin subir: no pisa la especie local', async () => {
    await mockTestDb.insert(trees).values({ ...arbolLocal('t1', ROBLE), especieBaseId: ALAMO });
    await mockTestDb.update(groups).set({ pendingSync: true }).where(eq(groups.id, GRUPO_ID));
    serverState.trees.set('t1', arbolDelServer('t1', PINO));

    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t1')).toMatchObject({ especieId: ROBLE, especieBaseId: ALAMO });
  });
});

/**
 * `pullFromServer` también corre suelto (pull-to-refresh), sin bajar antes el
 * catálogo: una especie nueva en el server puede no estar en el local (#614).
 */
describe('pull — especie ausente del catálogo local', () => {
  const especiesLocales = async () => (await mockTestDb.select({ id: species.id }).from(species)).map((e) => e.id);

  it('baja la especie antes de escribir el árbol que la usa', async () => {
    serverState.species.set(ALAMO, especieDelServer(ALAMO, 'ALA', 'Álamo'));
    serverState.trees.set('t1', arbolDelServer('t1', ALAMO));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t1')).especieId).toBe(ALAMO);
    expect(await especiesLocales()).toContain(ALAMO);
  });

  it('baja la especie antes de escribir plantation_species', async () => {
    serverState.species.set(ALAMO, especieDelServer(ALAMO, 'ALA', 'Álamo'));
    serverState.plantation_species.set('ps-1', { plantation_id: PLANTACION_ID, species_id: ALAMO, orden_visual: 0 });

    await pullFromServer(PLANTACION_ID);

    const filas = await mockTestDb.select().from(plantationSpecies);
    expect(filas.map((f) => f.especieId)).toEqual([ALAMO]);
    expect(await especiesLocales()).toContain(ALAMO);
  });

  it('especie que el server no devuelve: no escribe hijos colgados y sigue con el resto', async () => {
    serverState.trees.set('t-huerfano', arbolDelServer('t-huerfano', 'sp-que-no-existe'));
    serverState.trees.set('t-ok', arbolDelServer('t-ok', ROBLE));
    serverState.plantation_species.set('ps-1', { plantation_id: PLANTACION_ID, species_id: 'sp-que-no-existe', orden_visual: 0 });

    await expect(pullFromServer(PLANTACION_ID)).resolves.toEqual({ estado: 'ok' });

    expect(await leerArbol('t-huerfano')).toBeUndefined();
    expect((await leerArbol('t-ok')).especieId).toBe(ROBLE);
    expect(await mockTestDb.select().from(plantationSpecies)).toHaveLength(0);
  });

  it('el server falla al bajar la especie: no escribe hijos colgados y el pull sigue', async () => {
    serverState.species.set(ALAMO, especieDelServer(ALAMO, 'ALA', 'Álamo'));
    serverState.trees.set('t1', arbolDelServer('t1', ALAMO));
    serverState.plantation_species.set('ps-1', { plantation_id: PLANTACION_ID, species_id: ALAMO, orden_visual: 0 });
    mockTablasConError.add('species');

    await expect(pullFromServer(PLANTACION_ID)).resolves.toEqual({ estado: 'ok' });

    expect(await leerArbol('t1')).toBeUndefined();
    expect(await mockTestDb.select().from(plantationSpecies)).toHaveLength(0);
    expect(await especiesLocales()).not.toContain(ALAMO);
  });

  it('árbol N/N (sin especie) se escribe igual', async () => {
    serverState.trees.set('t-nn', arbolDelServer('t-nn', null));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t-nn')).especieId).toBeNull();
  });
});

/**
 * Con un INSERT multi-fila el `set` del upsert es UNO para todo el lote: lo que
 * antes decidía un ternario por fila (foto, GPS) ahora tiene que viajar en los
 * valores y resolverse con `excluded`. Un lote mixto es la única forma de ver si
 * se coló un dato de una fila en la regla de las demás (#449).
 */
describe('pull de árboles — reglas de merge en un lote mixto', () => {
  const conFoto = (id: string, fotoUrl: string | null, fotoSynced: boolean) => ({
    ...arbolLocal(id, ROBLE), fotoUrl, fotoSynced,
  });

  it('cada árbol resuelve su foto con su propia fila, no con la del vecino', async () => {
    await mockTestDb.insert(trees).values([
      conFoto('t-local', 'file:///data/foto-local.jpg', false),
      conFoto('t-sin-foto', null, false),
      conFoto('t-ya-baja', 'file:///data/vieja.jpg', true),
    ]);
    serverState.trees.set('t-local', { ...arbolDelServer('t-local', ROBLE), foto_url: 'plantations/p/t-local.jpg' });
    // Sin foto en el server: no debe tocar fotoSynced de esta fila.
    serverState.trees.set('t-sin-foto', arbolDelServer('t-sin-foto', ROBLE));
    serverState.trees.set('t-ya-baja', { ...arbolDelServer('t-ya-baja', ROBLE), foto_url: 'plantations/p/t-ya-baja.jpg' });

    await pullFromServer(PLANTACION_ID);

    // La foto local sin subir gana contra la del server, pero ya está en Storage.
    const local = await leerArbol('t-local');
    expect(local.fotoUrl).toBe('file:///data/foto-local.jpg');
    expect(local.fotoSynced).toBe(true);

    // El server no tiene foto: fotoSynced queda como estaba, no lo pisa el vecino.
    const sinFoto = await leerArbol('t-sin-foto');
    expect(sinFoto.fotoUrl).toBeNull();
    expect(sinFoto.fotoSynced).toBe(false);

    const yaBaja = await leerArbol('t-ya-baja');
    expect(yaBaja.fotoUrl).toBe('file:///data/vieja.jpg');
    expect(yaBaja.fotoSynced).toBe(true);
  });

  it('un árbol nuevo del server adopta su foto remota sin arrastrar la del lote', async () => {
    await mockTestDb.insert(trees).values(conFoto('t-local', 'file:///data/foto-local.jpg', false));
    serverState.trees.set('t-local', { ...arbolDelServer('t-local', ROBLE), foto_url: 'plantations/p/t-local.jpg' });
    serverState.trees.set('t-nuevo', { ...arbolDelServer('t-nuevo', ROBLE), foto_url: 'plantations/p/t-nuevo.jpg' });

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t-nuevo')).fotoUrl).toBe('plantations/p/t-nuevo.jpg');
    expect((await leerArbol('t-nuevo')).fotoSynced).toBe(true);
    expect((await leerArbol('t-local')).fotoUrl).toBe('file:///data/foto-local.jpg');
  });

  // Un APK viejo llegó a subir la ruta local del teléfono: acá no apunta a nada.
  it('una foto_url file:// que llega del server no se adopta como foto', async () => {
    serverState.trees.set('t-nuevo', { ...arbolDelServer('t-nuevo', ROBLE), foto_url: 'file:///data/otro-telefono/t.jpg' });
    serverState.trees.set('t-sin-foto', { ...arbolDelServer('t-sin-foto', ROBLE), foto_url: null });

    await pullFromServer(PLANTACION_ID);

    for (const id of ['t-nuevo', 't-sin-foto']) {
      const fila = await leerArbol(id);
      expect(fila.fotoUrl).toBeNull();
      expect(fila.fotoSynced).toBe(false);
    }
  });

  it('cada árbol conserva o adopta su propio punto GPS', async () => {
    await mockTestDb.insert(trees).values([
      { ...arbolLocal('t-con-gps', ROBLE), latitude: -34.5, longitude: -58.5, gpsAccuracy: 5, gpsCapturedAt: '2026-01-02T00:00:00' },
      arbolLocal('t-sin-gps', ROBLE),
    ]);
    serverState.trees.set('t-con-gps', { ...arbolDelServer('t-con-gps', ROBLE), latitude: -30, longitude: -60, gps_accuracy: 99, gps_captured_at: '2026-01-03T00:00:00' });
    serverState.trees.set('t-sin-gps', { ...arbolDelServer('t-sin-gps', ROBLE), latitude: -31, longitude: -61, gps_accuracy: 8, gps_captured_at: '2026-01-04T00:00:00' });

    await pullFromServer(PLANTACION_ID);

    // Captura local pendiente de push: gana contra la del server.
    const conGps = await leerArbol('t-con-gps');
    expect(conGps.latitude).toBe(-34.5);
    expect(conGps.gpsAccuracy).toBe(5);

    // Sin punto local: adopta el del server, no el del vecino.
    const sinGps = await leerArbol('t-sin-gps');
    expect(sinGps.latitude).toBe(-31);
    expect(sinGps.gpsAccuracy).toBe(8);
  });
});

describe('pull de grupos — parcela obligatoria (#90)', () => {
  const grupoDelServer = (id: string, parcelaId: string | null) => ({
    id, plantation_id: PLANTACION_ID, parcela_id: parcelaId, nombre: `G ${id}`, codigo: id,
    tipo: 'linea', estado: 'activa', usuario_creador: 'user-tecnico-1', created_at: '2026-01-01T00:00:00',
  });

  it('un grupo del server sin parcela aborta el pull', async () => {
    serverState.groups.set('g-roto', grupoDelServer('g-roto', null));

    await expect(pullFromServer(PLANTACION_ID)).rejects.toThrow('sin parcela en el server');
  });

  // El pull no escribe los grupos con cambios locales sin subir, así que su fila
  // del server —vieja e inválida— no tiene por qué abortar nada.
  it('un grupo sin parcela pero con cambios locales pendientes no aborta', async () => {
    await mockTestDb.insert(groups).values({
      id: 'g-pendiente', plantacionId: PLANTACION_ID, parcelaId: 'parc-1', nombre: 'Pendiente', codigo: 'GP',
      tipo: 'linea', estado: 'activa', usuarioCreador: 'user-tecnico-1', createdAt: '2026-01-01T00:00:00', pendingSync: true,
    });
    serverState.groups.set('g-pendiente', grupoDelServer('g-pendiente', null));

    await expect(pullFromServer(PLANTACION_ID)).resolves.toEqual({ estado: 'ok' });

    const [local] = await mockTestDb.select().from(groups).where(eq(groups.id, 'g-pendiente'));
    expect(local.parcelaId).toBe('parc-1');
  });
});

describe('pull de árboles — costo en statements (#449)', () => {
  const CANTIDAD = 120;

  beforeEach(async () => {
    const locales = Array.from({ length: CANTIDAD }, (_, i) => arbolLocal(`t${i}`, ROBLE));
    await mockTestDb.insert(trees).values(locales);
    for (let i = 0; i < CANTIDAD; i++) serverState.trees.set(`t${i}`, arbolDelServer(`t${i}`, ROBLE));
  });

  it('lee los árboles locales una sola vez, no dos por árbol', async () => {
    const ejecutadas = registrarSql(sqlite);

    await pullFromServer(PLANTACION_ID);

    const lecturas = ejecutadas.filter((s) => s.startsWith('select') && s.includes('"trees"'));
    expect(lecturas).toHaveLength(1);
  });

  it('upsertea en un statement por lote, no uno por árbol', async () => {
    const ejecutadas = registrarSql(sqlite);

    await pullFromServer(PLANTACION_ID);

    const inserts = ejecutadas.filter((s) => s.startsWith('insert into "trees"'));
    expect(inserts).toHaveLength(1);
  });
});

// El guard de sesión exige que el usuario cacheado sea el de la sesión (#658).
beforeEach(() => conUsuarioCacheado('user-tecnico-1'));
