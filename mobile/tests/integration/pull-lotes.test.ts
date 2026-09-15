/**
 * Integration tests de las fases del pull que pasaron a escribir en lotes (#449),
 * contra SQLite real: el upsert multi-fila, el chequeo de conflicto de especie
 * resuelto con una sola lectura, y el guard de parcela obligatoria de los grupos.
 *
 * La suite que cubría el conflicto (`CrossDeviceSync`) está `describe.skip`
 * (#333), así que sin esto el camino quedaba sin red.
 *
 * Mock de Supabase: estado in-memory por tabla.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';

const mockServerState: Record<string, Map<string, any>> = {
  plantations: new Map(),
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
};
const serverState = mockServerState;

jest.mock('../../src/supabase/client', () => {
  const filtrar = (tabla: string, filtros: Array<{ col: string; op: string; value: any }>) =>
    Array.from(mockServerState[tabla]?.values() ?? []).filter((fila: any) =>
      filtros.every((f) =>
        f.op === 'eq' ? fila[f.col] === f.value : Array.isArray(f.value) && f.value.includes(fila[f.col]),
      ),
    );

  const builder = (tabla: string) => {
    const filtros: Array<{ col: string; op: string; value: any }> = [];
    const api: any = {
      select() { return api; },
      eq(col: string, value: any) { filtros.push({ col, op: 'eq', value }); return api; },
      in(col: string, value: any[]) { filtros.push({ col, op: 'in', value }); return api; },
      single() {
        const filas = filtrar(tabla, filtros);
        return Promise.resolve({ data: filas[0] ?? null, error: filas[0] ? null : { code: 'PGRST116' } });
      },
      then(resolver: any) {
        return Promise.resolve({ data: filtrar(tabla, filtros), error: null }).then(resolver);
      },
    };
    return api;
  };

  return {
    supabase: {
      from: (tabla: string) => ({ select: () => builder(tabla) }),
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
  sub_id: `${id}-sub`,
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
  sqlite.pragma('foreign_keys = OFF');
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();

  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(species);
  await mockTestDb.delete(plantations);

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

describe('pull de árboles — conflicto de especie', () => {
  it('descarga fresh: inserta todos los árboles del server', async () => {
    serverState.trees.set('t1', arbolDelServer('t1', ROBLE));
    serverState.trees.set('t2', arbolDelServer('t2', PINO));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t1')).especieId).toBe(ROBLE);
    expect((await leerArbol('t2')).especieId).toBe(PINO);
  });

  it('especie local distinta de la del server: marca el conflicto y NO pisa la local', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', ROBLE));
    serverState.trees.set('t1', arbolDelServer('t1', PINO));

    await pullFromServer(PLANTACION_ID);

    const fila = await leerArbol('t1');
    expect(fila.especieId).toBe(ROBLE);
    expect(fila.conflictEspecieId).toBe(PINO);
    // El nombre sale del catálogo local, en una query para todos los conflictos.
    expect(fila.conflictEspecieNombre).toBe('Pino');
  });

  it('especie del server que el catálogo local no tiene: el conflicto igual se marca', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', ROBLE));
    serverState.trees.set('t1', arbolDelServer('t1', 'sp-que-no-existe'));

    await pullFromServer(PLANTACION_ID);

    expect((await leerArbol('t1')).conflictEspecieNombre).toBe('Desconocida');
  });

  it('misma especie en ambos lados: no hay conflicto', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', ROBLE));
    serverState.trees.set('t1', arbolDelServer('t1', ROBLE));

    await pullFromServer(PLANTACION_ID);

    const fila = await leerArbol('t1');
    expect(fila.especieId).toBe(ROBLE);
    expect(fila.conflictEspecieId).toBeNull();
  });

  it('sin especie local: adopta la del server sin marcar conflicto', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', null));
    serverState.trees.set('t1', arbolDelServer('t1', PINO));

    await pullFromServer(PLANTACION_ID);

    const fila = await leerArbol('t1');
    expect(fila.especieId).toBe(PINO);
    expect(fila.conflictEspecieId).toBeNull();
  });

  it('server sin especie: no hay conflicto aunque la local tenga una', async () => {
    await mockTestDb.insert(trees).values(arbolLocal('t1', ROBLE));
    serverState.trees.set('t1', arbolDelServer('t1', null));

    await pullFromServer(PLANTACION_ID);

    const fila = await leerArbol('t1');
    expect(fila.especieId).toBe(ROBLE);
    expect(fila.conflictEspecieId).toBeNull();
  });

  it('un conflicto resuelto a favor del server limpia las marcas viejas', async () => {
    await mockTestDb.insert(trees).values({ ...arbolLocal('t1', ROBLE), conflictEspecieId: PINO, conflictEspecieNombre: 'Pino' });
    serverState.trees.set('t1', arbolDelServer('t1', ROBLE));

    await pullFromServer(PLANTACION_ID);

    const fila = await leerArbol('t1');
    expect(fila.conflictEspecieId).toBeNull();
    expect(fila.conflictEspecieNombre).toBeNull();
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
