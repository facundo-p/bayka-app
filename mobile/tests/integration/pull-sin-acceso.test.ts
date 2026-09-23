/**
 * Integration tests: pullFromServer ante una membresía revocada (#317) o una
 * plantación eliminada en el servidor (#478).
 * Con las policies por membresía el server devuelve `{ data: [], error: null }`
 * en cada paso; sin el chequeo explícito eso se lee como "está vacío" y el pull
 * borra filas locales sin avisar.
 *
 * Mock de Supabase: estado in-memory por tabla + sesión.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import {
  plantations,
  parcelas,
  groups,
  plantationUsers,
} from '../../src/database/schema';

const mockServerState: Record<string, Map<string, any>> = {
  plantations: new Map(),
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
};
const mockSesion: { userId: string | null } = { userId: 'user-tecnico-1' };
const mockFallas: { membresia: boolean; estadoRemoto: boolean } = { membresia: false, estadoRemoto: false };
/** `existe=false` simula un server sin la migración de `estado_remoto_plantaciones`. */
const mockRpc: { existe: boolean; eliminadas: Set<string> } = { existe: true, eliminadas: new Set() };

const serverState = mockServerState;
const sesion = mockSesion;
const fallas = mockFallas;
const rpc = mockRpc;

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
      limit() { return api; },
      single() {
        const filas = filtrar(tabla, filtros);
        return Promise.resolve({ data: filas[0] ?? null, error: filas[0] ? null : { code: 'PGRST116' } });
      },
      then(resolver: any) {
        if (tabla === 'plantation_users' && mockFallas.membresia) {
          return Promise.resolve({ data: null, error: { message: 'Network request failed' } }).then(resolver);
        }
        return Promise.resolve({ data: filtrar(tabla, filtros), error: null }).then(resolver);
      },
    };
    return api;
  };

  // Mismo criterio que el RPC real: eliminada > miembro (archivada/ok) > sin_acceso.
  const estadoRemoto = (id: string) => {
    if (mockRpc.eliminadas.has(id)) return 'eliminada';
    const plantacion = mockServerState.plantations.get(id);
    const miembro = filtrar('plantation_users', [
      { col: 'plantation_id', op: 'eq', value: id },
      { col: 'user_id', op: 'eq', value: mockSesion.userId },
    ]).length > 0;
    if (!plantacion || !miembro) return 'sin_acceso';
    return plantacion.archivada_en ? 'archivada' : 'ok';
  };

  return {
    supabase: {
      rpc: (nombre: string, args: { p_ids: string[] }) => {
        if (!mockRpc.existe || nombre !== 'estado_remoto_plantaciones') {
          return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
        }
        if (mockFallas.estadoRemoto) {
          return Promise.resolve({ data: null, error: { message: 'Network request failed' } });
        }
        return Promise.resolve({ data: args.p_ids.map((id) => ({ id, estado: estadoRemoto(id) })), error: null });
      },
      from: (tabla: string) => ({
        select: () => builder(tabla),
        eq: (col: string, value: any) => builder(tabla).eq(col, value),
      }),
      auth: {
        getSession: () =>
          Promise.resolve({
            data: mockSesion.userId ? { session: { user: { id: mockSesion.userId } } } : { session: null },
          }),
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
  // `enTransaccion` abre la transacción por acá: sin esto el test correría sin
  // transacción y no probaría la atomicidad que dice probar (#448).
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

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();
  sesion.userId = 'user-tecnico-1';
  fallas.membresia = false;
  fallas.estadoRemoto = false;
  rpc.existe = true;
  rpc.eliminadas.clear();

  await vaciarTablas(mockTestDb);

  // Copia local ya descargada: plantación + parcela + grupo + membresía.
  await mockTestDb
    .insert(plantations)
    .values(createTestPlantation({ id: PLANTACION_ID, lugar: 'Campo Test', periodo: '2026' }));
  await mockTestDb.insert(parcelas).values({
    id: 'parc-1',
    plantacionId: PLANTACION_ID,
    nombre: 'Norte',
    codigo: 'P1',
    descripcion: null,
    pendingSync: false,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    deletedAt: null,
  });
  await mockTestDb.insert(groups).values({
    id: 'g-1',
    plantacionId: PLANTACION_ID,
    parcelaId: 'parc-1',
    nombre: 'Linea A',
    codigo: 'LA',
    tipo: 'linea',
    estado: 'activa',
    usuarioCreador: 'user-tecnico-1',
    createdAt: '2026-01-01T00:00:00',
    pendingSync: false,
  });
  await mockTestDb.insert(plantationUsers).values({
    plantationId: PLANTACION_ID,
    userId: 'user-tecnico-1',
    rolEnPlantacion: 'tecnico',
    assignedAt: '2026-01-01T00:00:00',
  });

  // El server conoce la plantación, pero la membresía se carga por test.
  serverState.plantations.set(PLANTACION_ID, {
    id: PLANTACION_ID,
    lugar: 'Campo Test',
    periodo: '2026',
    estado: 'activa',
    creado_por: 'admin-1',
    created_at: '2026-01-01T00:00:00',
    visible_in_app: true,
  });
});

async function filasLocales() {
  return {
    parcelas: await mockTestDb.select().from(parcelas).where(eq(parcelas.plantacionId, PLANTACION_ID)),
    grupos: await mockTestDb.select().from(groups).where(eq(groups.plantacionId, PLANTACION_ID)),
    membresias: await mockTestDb
      .select()
      .from(plantationUsers)
      .where(eq(plantationUsers.plantationId, PLANTACION_ID)),
  };
}

describe('pullFromServer con membresía revocada', () => {
  it('devuelve sin-acceso en vez de leer el server vacío como "no hay nada"', async () => {
    // El server no tiene fila de membresía para este usuario: RLS lo filtra todo.
    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'sin-acceso' });
  });

  it('no toca la copia local: los datos quedan para consulta', async () => {
    const antes = await filasLocales();

    await pullFromServer(PLANTACION_ID);

    const despues = await filasLocales();
    expect(despues.parcelas).toEqual(antes.parcelas);
    expect(despues.grupos).toEqual(antes.grupos);
    // Sin el chequeo, el replace destructivo de plantation_users borraba esta fila.
    expect(despues.membresias).toHaveLength(1);
  });

  it('con membresía vigente el pull corre normal', async () => {
    serverState.plantation_users.set('pu-1', {
      plantation_id: PLANTACION_ID,
      user_id: 'user-tecnico-1',
      rol_en_plantacion: 'tecnico',
      assigned_at: '2026-01-01T00:00:00',
    });

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });
  });
});

describe('pullFromServer: cuándo NO hay que gritar "sin acceso"', () => {
  it('si el chequeo falla (offline) asume acceso y sigue', async () => {
    fallas.estadoRemoto = true;

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });
  });

  it('sin sesión no inventa una revocación', async () => {
    sesion.userId = null;

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });
  });

  it('plantación creada offline (pendiente de push): el server todavía no la conoce', async () => {
    await mockTestDb
      .update(plantations)
      .set({ pendingSync: true })
      .where(eq(plantations.id, PLANTACION_ID));

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });
  });
});

describe('server sin estado_remoto_plantaciones: cae al chequeo de membresía', () => {
  beforeEach(() => { rpc.existe = false; });

  it('sin membresía sigue devolviendo sin-acceso', async () => {
    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'sin-acceso' });
  });

  it('con membresía el pull corre normal', async () => {
    serverState.plantation_users.set('pu-1', {
      plantation_id: PLANTACION_ID,
      user_id: 'user-tecnico-1',
      rol_en_plantacion: 'tecnico',
      assigned_at: '2026-01-01T00:00:00',
    });

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });
  });

  it('si la membresía falla (offline) asume acceso', async () => {
    fallas.membresia = true;

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });
  });
});

describe('plantación eliminada en el servidor (#478)', () => {
  async function eliminadaEnServidorEn() {
    const [fila] = await mockTestDb
      .select({ marca: plantations.eliminadaEnServidorEn })
      .from(plantations)
      .where(eq(plantations.id, PLANTACION_ID));
    return fila.marca;
  }

  beforeEach(() => {
    serverState.plantations.delete(PLANTACION_ID);
    rpc.eliminadas.add(PLANTACION_ID);
  });

  it('devuelve eliminada y no toca la copia local', async () => {
    const antes = await filasLocales();

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'eliminada' });

    const despues = await filasLocales();
    expect(despues.parcelas).toEqual(antes.parcelas);
    expect(despues.grupos).toEqual(antes.grupos);
    expect(despues.membresias).toHaveLength(1);
  });

  it('marca eliminada_en_servidor_en y conserva la primera fecha', async () => {
    await pullFromServer(PLANTACION_ID);
    expect(await eliminadaEnServidorEn()).not.toBeNull();

    await mockTestDb
      .update(plantations)
      .set({ eliminadaEnServidorEn: '2026-01-01T00:00:00.000Z' })
      .where(eq(plantations.id, PLANTACION_ID));
    await pullFromServer(PLANTACION_ID);

    expect(await eliminadaEnServidorEn()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('si el server vuelve a reconocerla, se limpia la marca', async () => {
    await pullFromServer(PLANTACION_ID);
    rpc.eliminadas.clear();
    serverState.plantations.set(PLANTACION_ID, {
      id: PLANTACION_ID, lugar: 'Campo Test', periodo: '2026', estado: 'activa',
      creado_por: 'admin-1', created_at: '2026-01-01T00:00:00', visible_in_app: true,
    });
    serverState.plantation_users.set('pu-1', {
      plantation_id: PLANTACION_ID, user_id: 'user-tecnico-1',
      rol_en_plantacion: 'tecnico', assigned_at: '2026-01-01T00:00:00',
    });

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });
    expect(await eliminadaEnServidorEn()).toBeNull();
  });

  it('un error de red no limpia la marca: sin evidencia no se asume que volvió', async () => {
    await pullFromServer(PLANTACION_ID);
    fallas.estadoRemoto = true;

    await pullFromServer(PLANTACION_ID);

    expect(await eliminadaEnServidorEn()).not.toBeNull();
  });

  it('sin_acceso tampoco limpia la marca', async () => {
    await pullFromServer(PLANTACION_ID);
    rpc.eliminadas.clear();

    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'sin-acceso' });
    expect(await eliminadaEnServidorEn()).not.toBeNull();
  });
});

/**
 * El replace destructivo visto desde el otro lado: acá el usuario de la sesión
 * conserva su membresía y el que desaparece del server es otro. Es el único
 * caso de las suites apagadas de `pullFromServer.test.ts` que no estaba
 * cubierto por ningún test de integración (#333).
 */
describe('pullFromServer: replace de membresías', () => {
  beforeEach(async () => {
    await mockTestDb.insert(plantationUsers).values({
      plantationId: PLANTACION_ID,
      userId: 'user-tecnico-2',
      rolEnPlantacion: 'tecnico',
      assignedAt: '2026-01-01T00:00:00',
    });
    // La sesión sigue siendo miembro: el pull corre y el server es autoridad.
    serverState.plantation_users.set('pu-1', {
      plantation_id: PLANTACION_ID,
      user_id: 'user-tecnico-1',
      rol_en_plantacion: 'tecnico',
      assigned_at: '2026-01-01T00:00:00',
    });
  });

  it('borra la membresía local que el server ya no tiene', async () => {
    expect(await pullFromServer(PLANTACION_ID)).toEqual({ estado: 'ok' });

    const { membresias } = await filasLocales();
    expect(membresias.map((fila) => fila.userId)).toEqual(['user-tecnico-1']);
  });

  it('actualiza el rol de la membresía que sigue', async () => {
    serverState.plantation_users.set('pu-1', {
      plantation_id: PLANTACION_ID,
      user_id: 'user-tecnico-1',
      rol_en_plantacion: 'admin',
      assigned_at: '2026-01-01T00:00:00',
    });

    await pullFromServer(PLANTACION_ID);

    const { membresias } = await filasLocales();
    expect(membresias).toEqual([
      expect.objectContaining({ userId: 'user-tecnico-1', rolEnPlantacion: 'admin' }),
    ]);
  });

  it('con la plantación pendiente de push no borra nada: el server no es autoridad', async () => {
    await mockTestDb
      .update(plantations)
      .set({ pendingSync: true })
      .where(eq(plantations.id, PLANTACION_ID));

    await pullFromServer(PLANTACION_ID);

    const { membresias } = await filasLocales();
    expect(membresias.map((fila) => fila.userId).sort()).toEqual([
      'user-tecnico-1',
      'user-tecnico-2',
    ]);
  });
});
