/**
 * Integration tests: captura GPS — schema + sync (issue #96)
 *
 * Cubre con SQLite real (migraciones drizzle completas, incluida la 0015):
 *  1. Defaults de plantations: gps_capture_frequency=10, gps_capture_required=true
 *  2. Round-trip local de columnas GPS en trees
 *  3. Push: payload del RPC sync_subgroup incluye las 4 columnas GPS
 *  4. Pull: árbol del server con coordenadas llega al local
 *  5. Pull: NO pisa coordenadas locales con NULL del server (re-captura pendiente)
 *  6. Pull metadata: refresca config GPS aun con pendingEdit=true, sin pisar lugar
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';

import { plantations, groups, trees } from '../../src/database/schema';
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';

// ─── Mock Supabase (prefijo mock* por hoisting de jest.mock) ─────────────────

const mockServerState: Record<string, Map<string, any>> = {
  plantations: new Map(),
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
};
const mockRpcCalls: Array<{ fn: string; args: any }> = [];

const serverState = mockServerState;
const rpcCalls = mockRpcCalls;

jest.mock('../../src/supabase/client', () => {
  const makeQueryBuilder = (table: string) => {
    const filters: Array<{ col: string; op: 'eq' | 'in'; value: any }> = [];
    const applyFilters = () => {
      const all = Array.from(mockServerState[table]?.values() ?? []);
      return all.filter((row) =>
        filters.every((f) =>
          f.op === 'eq' ? row[f.col] === f.value : Array.isArray(f.value) && f.value.includes(row[f.col])
        )
      );
    };
    const builder: any = {
      select() { return builder; },
      eq(col: string, value: any) { filters.push({ col, op: 'eq', value }); return builder; },
      in(col: string, value: any[]) { filters.push({ col, op: 'in', value }); return builder; },
      single() {
        const rows = applyFilters();
        return Promise.resolve({ data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116' } });
      },
      then(resolve: any) {
        return Promise.resolve({ data: applyFilters(), error: null }).then(resolve);
      },
    };
    return builder;
  };
  return {
    supabase: {
      from(table: string) {
        return {
          select() { return makeQueryBuilder(table); },
          eq(col: string, value: any) { return makeQueryBuilder(table).eq(col, value); },
          upsert(row: any) {
            mockServerState[table].set(row.id, { ...row });
            return Promise.resolve({ data: row, error: null });
          },
        };
      },
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'user-tecnico-1' } } }),
      },
      rpc(fn: string, args: any) {
        mockRpcCalls.push({ fn, args });
        return Promise.resolve({ data: { success: true }, error: null });
      },
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
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

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Imports DESPUÉS de los mocks
import { pullFromServer } from '../../src/services/sync/pullService';
import { uploadSyncableGroups } from '../../src/services/sync/pushService';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLANTATION_ID = '11111111-1111-1111-1111-111111111111';
const GROUP_ID = '22222222-2222-2222-2222-222222222222';
const NOW = '2026-06-10T12:00:00.000Z';

async function seedLocalPlantation(overrides: Partial<typeof plantations.$inferInsert> = {}) {
  await mockTestDb.insert(plantations).values({
    id: PLANTATION_ID,
    organizacionId: 'org-1',
    lugar: 'Campo Norte',
    periodo: '2026',
    estado: 'activa',
    creadoPor: 'user-admin-1',
    createdAt: NOW,
    pendingSync: false,
    ...overrides,
  });
}

async function seedLocalGroup(pendingSync: boolean) {
  await mockTestDb.insert(groups).values({
    id: GROUP_ID,
    plantacionId: PLANTATION_ID,
    parcelaId: null,
    nombre: 'Línea 1',
    codigo: 'L1',
    tipo: 'linea',
    estado: 'finalizada',
    usuarioCreador: 'user-tecnico-1',
    createdAt: NOW,
    pendingSync,
  });
}

function localTree(overrides: Partial<typeof trees.$inferInsert> = {}) {
  return {
    id: 'tree-1',
    groupId: GROUP_ID,
    especieId: null,
    posicion: 1,
    subId: 'PL1NN1',
    fotoUrl: null,
    fotoSynced: false,
    usuarioRegistro: 'user-tecnico-1',
    createdAt: NOW,
    ...overrides,
  };
}

function serverTree(overrides: Record<string, any> = {}) {
  return {
    id: 'tree-1',
    group_id: GROUP_ID,
    species_id: null,
    posicion: 1,
    sub_id: 'PL1NN1',
    foto_url: null,
    plantacion_id: null,
    global_id: null,
    usuario_registro: 'user-tecnico-1',
    created_at: NOW,
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    gps_captured_at: null,
    ...overrides,
  };
}

function serverPlantation(overrides: Record<string, any> = {}) {
  serverState.plantations.set(PLANTATION_ID, {
    id: PLANTATION_ID,
    lugar: 'Campo Norte',
    periodo: '2026',
    estado: 'activa',
    gps_capture_frequency: 10,
    gps_capture_required: true,
    ...overrides,
  });
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(plantations);
  for (const k of Object.keys(serverState)) serverState[k].clear();
  rpcCalls.length = 0;
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GPS — schema local (migración 0015)', () => {
  test('plantación nueva queda con frecuencia 10 y captura obligatoria por default', async () => {
    await seedLocalPlantation();
    const [row] = await mockTestDb.select().from(plantations).where(eq(plantations.id, PLANTATION_ID));
    expect(row.gpsCaptureFrequency).toBe(10);
    expect(row.gpsCaptureRequired).toBe(true);
  });

  test('round-trip de columnas GPS en trees (árbol histórico queda NULL)', async () => {
    await seedLocalPlantation();
    await seedLocalGroup(false);
    await mockTestDb.insert(trees).values(localTree({
      latitude: -31.123456,
      longitude: -60.654321,
      gpsAccuracy: 3.5,
      gpsCapturedAt: NOW,
    }));
    await mockTestDb.insert(trees).values(localTree({ id: 'tree-historico', posicion: 2, subId: 'PL1NN2' }));

    const rows = await mockTestDb.select().from(trees);
    const conGps = rows.find((r) => r.id === 'tree-1')!;
    const sinGps = rows.find((r) => r.id === 'tree-historico')!;
    expect(conGps.latitude).toBeCloseTo(-31.123456);
    expect(conGps.longitude).toBeCloseTo(-60.654321);
    expect(conGps.gpsAccuracy).toBeCloseTo(3.5);
    expect(conGps.gpsCapturedAt).toBe(NOW);
    expect(sinGps.latitude).toBeNull();
    expect(sinGps.gpsCapturedAt).toBeNull();
  });
});

describe('GPS — push (payload del RPC sync_subgroup)', () => {
  test('árbol con coordenadas viaja con las 4 columnas; sin coordenadas viaja con NULL', async () => {
    await seedLocalPlantation();
    await seedLocalGroup(true);
    await mockTestDb.insert(trees).values(localTree({
      latitude: -31.5,
      longitude: -60.7,
      gpsAccuracy: 2.1,
      gpsCapturedAt: NOW,
    }));
    await mockTestDb.insert(trees).values(localTree({ id: 'tree-2', posicion: 2, subId: 'PL1NN2' }));

    await uploadSyncableGroups(PLANTATION_ID);

    const syncCall = rpcCalls.find((c) => c.fn === 'sync_subgroup');
    expect(syncCall).toBeDefined();
    const pushedTrees = syncCall!.args.p_trees as any[];
    const conGps = pushedTrees.find((t) => t.id === 'tree-1');
    const sinGps = pushedTrees.find((t) => t.id === 'tree-2');
    expect(conGps).toMatchObject({
      latitude: -31.5,
      longitude: -60.7,
      gps_accuracy: 2.1,
      gps_captured_at: NOW,
    });
    expect(sinGps).toMatchObject({
      latitude: null,
      longitude: null,
      gps_accuracy: null,
      gps_captured_at: null,
    });
  });
});

describe('GPS — pull de árboles', () => {
  test('árbol del server con coordenadas llega al local', async () => {
    await seedLocalPlantation();
    serverPlantation();
    serverState.groups.set(GROUP_ID, {
      id: GROUP_ID,
      plantation_id: PLANTATION_ID,
      parcela_id: null,
      nombre: 'Línea 1',
      codigo: 'L1',
      tipo: 'linea',
      estado: 'finalizada',
      usuario_creador: 'user-tecnico-1',
      created_at: NOW,
    });
    serverState.trees.set('tree-1', serverTree({
      latitude: -31.9,
      longitude: -60.1,
      gps_accuracy: 5.0,
      gps_captured_at: NOW,
    }));

    await pullFromServer(PLANTATION_ID);

    const [row] = await mockTestDb.select().from(trees).where(eq(trees.id, 'tree-1'));
    expect(row.latitude).toBeCloseTo(-31.9);
    expect(row.longitude).toBeCloseTo(-60.1);
    expect(row.gpsAccuracy).toBeCloseTo(5.0);
    expect(row.gpsCapturedAt).toBe(NOW);
  });

  test('pull NO pisa coordenadas locales con NULL del server', async () => {
    await seedLocalPlantation();
    serverPlantation();
    await seedLocalGroup(false);
    await mockTestDb.insert(trees).values(localTree({
      latitude: -31.5,
      longitude: -60.7,
      gpsAccuracy: 2.1,
      gpsCapturedAt: NOW,
    }));
    serverState.groups.set(GROUP_ID, {
      id: GROUP_ID,
      plantation_id: PLANTATION_ID,
      parcela_id: null,
      nombre: 'Línea 1',
      codigo: 'L1',
      tipo: 'linea',
      estado: 'finalizada',
      usuario_creador: 'user-tecnico-1',
      created_at: NOW,
    });
    // El server aún no recibió la captura local (push pendiente) → trae NULL.
    serverState.trees.set('tree-1', serverTree());

    await pullFromServer(PLANTATION_ID);

    const [row] = await mockTestDb.select().from(trees).where(eq(trees.id, 'tree-1'));
    expect(row.latitude).toBeCloseTo(-31.5);
    expect(row.longitude).toBeCloseTo(-60.7);
    expect(row.gpsAccuracy).toBeCloseTo(2.1);
    expect(row.gpsCapturedAt).toBe(NOW);
  });
});

describe('GPS — pull de config de plantación (fix del gap de metadata)', () => {
  test('cambio de frecuencia/obligatoriedad del admin llega por pull', async () => {
    await seedLocalPlantation();
    serverPlantation({ gps_capture_frequency: 5, gps_capture_required: false });

    await pullFromServer(PLANTATION_ID);

    const [row] = await mockTestDb.select().from(plantations).where(eq(plantations.id, PLANTATION_ID));
    expect(row.gpsCaptureFrequency).toBe(5);
    expect(row.gpsCaptureRequired).toBe(false);
  });

  test('con pendingEdit=true refresca config GPS pero NO pisa lugar/periodo locales', async () => {
    await seedLocalPlantation({ pendingEdit: true, lugar: 'Editado Offline', periodo: '2027' });
    serverPlantation({ lugar: 'Campo Server', periodo: '2026', gps_capture_frequency: 3 });

    await pullFromServer(PLANTATION_ID);

    const [row] = await mockTestDb.select().from(plantations).where(eq(plantations.id, PLANTATION_ID));
    expect(row.gpsCaptureFrequency).toBe(3);
    expect(row.lugar).toBe('Editado Offline');
    expect(row.periodo).toBe('2027');
  });

  test('server sin migración 023 (columnas ausentes) no rompe ni escribe NULL', async () => {
    await seedLocalPlantation();
    serverPlantation({ gps_capture_frequency: undefined, gps_capture_required: undefined });

    await pullFromServer(PLANTATION_ID);

    const [row] = await mockTestDb.select().from(plantations).where(eq(plantations.id, PLANTATION_ID));
    expect(row.gpsCaptureFrequency).toBe(10);
    expect(row.gpsCaptureRequired).toBe(true);
  });
});
