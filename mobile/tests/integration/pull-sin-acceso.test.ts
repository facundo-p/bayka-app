/**
 * Integration tests: pullFromServer ante una membresía revocada (#317).
 * Con las policies por membresía el server devuelve `{ data: [], error: null }`
 * en cada paso; sin el chequeo explícito eso se lee como "está vacío" y el pull
 * borra filas locales sin avisar.
 *
 * Mock de Supabase: estado in-memory por tabla + sesión.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
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
const mockFallas: { membresia: boolean } = { membresia: false };

const serverState = mockServerState;
const sesion = mockSesion;
const fallas = mockFallas;

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

  return {
    supabase: {
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
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
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
  sqlite.pragma('foreign_keys = OFF');
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();
  sesion.userId = 'user-tecnico-1';
  fallas.membresia = false;

  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(plantationUsers);
  await mockTestDb.delete(plantations);

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
    fallas.membresia = true;

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
