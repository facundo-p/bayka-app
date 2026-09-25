/**
 * Integration: datos de plantación editables desde mobile (#633). SQLite real
 * (migración 0024): pull con y sin edición pendiente, push de altas y ediciones
 * con los campos nuevos, descartar, y el aviso de duplicado post-sync.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';

import { plantations } from '../../src/database/schema';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';

// ─── Mock Supabase (prefijo mock* por hoisting de jest.mock) ─────────────────

const mockServerState: Record<string, Map<string, any>> = {
  plantations: new Map(),
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
};
const mockUpdates: { table: string; payload: any }[] = [];
const mockInserts: { table: string; row: any }[] = [];

jest.mock('../../src/supabase/client', () => {
  const ilike = (a: unknown, b: string) => String(a).toLowerCase() === b.toLowerCase();
  const makeQueryBuilder = (table: string, opciones: { head?: boolean } = {}) => {
    const filtros: ((row: any) => boolean)[] = [];
    const filas = () => Array.from(mockServerState[table]?.values() ?? []).filter((r) => filtros.every((f) => f(r)));
    const builder: any = {
      select() { return builder; },
      eq(col: string, v: any) { filtros.push((r) => r[col] === v); return builder; },
      neq(col: string, v: any) { filtros.push((r) => r[col] !== v); return builder; },
      in(col: string, v: any[]) { filtros.push((r) => v.includes(r[col])); return builder; },
      ilike(col: string, v: string) { filtros.push((r) => ilike(r[col], v)); return builder; },
      single() {
        const rows = filas();
        return Promise.resolve({ data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116' } });
      },
      then(resolve: any) {
        const rows = filas();
        const respuesta = opciones.head ? { data: null, count: rows.length, error: null } : { data: rows, error: null };
        return Promise.resolve(respuesta).then(resolve);
      },
    };
    return builder;
  };
  return {
    supabase: {
      from(table: string) {
        return {
          select(_cols?: string, opciones?: { head?: boolean }) { return makeQueryBuilder(table, opciones); },
          eq(col: string, value: any) { return makeQueryBuilder(table).eq(col, value); },
          insert(row: any) {
            mockInserts.push({ table, row });
            mockServerState[table].set(row.id, { ...row });
            return Promise.resolve({ data: null, error: null });
          },
          upsert(row: any) { return Promise.resolve({ data: row, error: null }); },
          update(payload: any) {
            mockUpdates.push({ table, payload });
            return {
              eq: (_col: string, id: string) => ({
                select: () => {
                  const actual = mockServerState[table].get(id);
                  if (actual) mockServerState[table].set(id, { ...actual, ...payload });
                  return Promise.resolve({ data: actual ? [{ id }] : [], error: null });
                },
              }),
            };
          },
        };
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-admin-1' } } } }),
        getUser: () => Promise.resolve({ data: { user: { id: 'user-admin-1' } } }),
      },
      rpc: () => Promise.resolve({ data: { success: true }, error: null }),
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
    },
  };
});

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() { return mockTestDb; },
  get sqlite() { return mockSqliteDeIntegracion; },
}));

jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));

jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { pullFromServer } from '../../src/services/sync/pullService';
import { uploadOfflinePlantations, uploadPendingEdits } from '../../src/services/sync/preSteps';
import { discardPlantationEdit } from '../../src/repositories/PlantationRepository';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLANTATION_ID = '11111111-1111-1111-1111-111111111111';
const OTRA_ID = '99999999-9999-9999-9999-999999999999';
const NOW = '2026-09-24T12:00:00.000Z';

async function seedLocal(overrides: Partial<typeof plantations.$inferInsert> = {}) {
  await mockTestDb.insert(plantations).values({
    id: PLANTATION_ID,
    organizacionId: 'org-1',
    lugar: 'Lote Norte',
    periodo: 'Otoño 2026',
    estado: 'activa',
    creadoPor: 'user-admin-1',
    createdAt: NOW,
    ...overrides,
  });
  mockServerState.plantation_users.set('pu', {
    plantation_id: PLANTATION_ID, user_id: 'user-admin-1', rol_en_plantacion: 'admin', assigned_at: NOW,
  });
}

function serverPlantation(id: string, overrides: Record<string, any> = {}) {
  mockServerState.plantations.set(id, {
    id,
    lugar: 'Lote Norte',
    periodo: 'Otoño 2026',
    estado: 'activa',
    gps_capture_frequency: 10,
    gps_capture_required: true,
    photo_capture_all_trees: false,
    visible_in_app: true,
    descripcion: null,
    fecha_inicio: null,
    objetivo_arboles: null,
    ...overrides,
  });
}

async function filaLocal() {
  const [row] = await mockTestDb.select().from(plantations).where(eq(plantations.id, PLANTATION_ID));
  return row;
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  for (const k of Object.keys(mockServerState)) mockServerState[k].clear();
  mockUpdates.length = 0;
  mockInserts.length = 0;
});

// ─── Pull ───────────────────────────────────────────────────────────────────

describe('pull de los datos de la plantación', () => {
  test('sin edición pendiente baja los valores y el snapshot', async () => {
    await seedLocal();
    serverPlantation(PLANTATION_ID, {
      descripcion: 'Ribera', fecha_inicio: '2026-04-15', objetivo_arboles: 12000,
      photo_capture_all_trees: true, visible_in_app: false,
    });

    await pullFromServer(PLANTATION_ID);

    expect(await filaLocal()).toMatchObject({
      descripcion: 'Ribera', fechaInicio: '2026-04-15', objetivoArboles: 12000,
      photoCaptureAllTrees: true, visibleInApp: false,
      descripcionServer: 'Ribera', objetivoArbolesServer: 12000,
      photoCaptureAllTreesServer: true, visibleInAppServer: false,
    });
  });

  test('con edición pendiente no pisa foto, visibilidad ni los datos nuevos, pero sí el snapshot', async () => {
    await seedLocal({
      pendingEdit: true, descripcion: 'Mía', objetivoArboles: 15000, photoCaptureAllTrees: true, visibleInApp: false,
    });
    serverPlantation(PLANTATION_ID, { descripcion: 'Web', objetivo_arboles: 12500, visible_in_app: true });

    await pullFromServer(PLANTATION_ID);

    expect(await filaLocal()).toMatchObject({
      descripcion: 'Mía', objetivoArboles: 15000, photoCaptureAllTrees: true, visibleInApp: false,
      descripcionServer: 'Web', objetivoArbolesServer: 12500, photoCaptureAllTreesServer: false, visibleInAppServer: true,
    });
  });

  test('un null del server en un opcional borra el valor local', async () => {
    await seedLocal({ descripcion: 'Vieja' });
    serverPlantation(PLANTATION_ID, { descripcion: null });

    await pullFromServer(PLANTATION_ID);

    expect((await filaLocal()).descripcion).toBeNull();
  });
});

// ─── Push ───────────────────────────────────────────────────────────────────

describe('push de altas y ediciones', () => {
  test('el alta offline sube los campos nuevos', async () => {
    await seedLocal({
      pendingSync: true, descripcion: 'Ribera', fechaInicio: '2026-04-15', objetivoArboles: 12000,
      photoCaptureAllTrees: true, visibleInApp: false,
    });

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado).toMatchObject({ success: true, duplicada: false });
    expect(mockInserts[0].row).toMatchObject({
      descripcion: 'Ribera', fecha_inicio: '2026-04-15', objetivo_arboles: 12000,
      photo_capture_all_trees: true, visible_in_app: false, gps_capture_frequency: 10,
    });
  });

  test('el alta avisa si el server ya tiene otra con el mismo lugar y periodo', async () => {
    await seedLocal({ pendingSync: true, lugar: ' lote norte ', periodo: 'OTOÑO 2026' });
    serverPlantation(OTRA_ID);

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado).toMatchObject({ success: true, duplicada: true });
  });

  test('la edición sube todos los campos, limpia pendingEdit y deja el snapshot con lo subido', async () => {
    await seedLocal({
      pendingEdit: true, lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026',
      objetivoArboles: 15000, objetivoArbolesServer: 12000, visibleInApp: false, visibleInAppServer: true,
    });
    serverPlantation(PLANTATION_ID, { objetivo_arboles: 12000 });

    const [resultado] = await uploadPendingEdits();

    expect(mockUpdates[0].payload).toMatchObject({ objetivo_arboles: 15000, visible_in_app: false, descripcion: null });
    expect(await filaLocal()).toMatchObject({
      pendingEdit: false, objetivoArbolesServer: 15000, visibleInAppServer: false,
    });
    // No cambió lugar ni periodo: no hay aviso aunque exista otra igual.
    expect(resultado).toMatchObject({ success: true, duplicada: false });
  });

  test('la edición que cambia el lugar a uno existente avisa el duplicado', async () => {
    await seedLocal({ pendingEdit: true, lugar: 'Campo Sur', lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026' });
    serverPlantation(PLANTATION_ID);
    serverPlantation(OTRA_ID, { lugar: 'Campo Sur' });

    const [resultado] = await uploadPendingEdits();

    expect(resultado).toMatchObject({ success: true, duplicada: true });
  });
});

// ─── Descartar ──────────────────────────────────────────────────────────────

describe('descartar una edición offline', () => {
  test('vuelve todos los campos al snapshot del server', async () => {
    await seedLocal({
      pendingEdit: true,
      lugar: 'Editado', lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026',
      descripcion: 'Mía', descripcionServer: null,
      objetivoArboles: 15000, objetivoArbolesServer: 12000,
      photoCaptureAllTrees: true, photoCaptureAllTreesServer: false,
      visibleInApp: false, visibleInAppServer: true,
    });

    await discardPlantationEdit(PLANTATION_ID);

    expect(await filaLocal()).toMatchObject({
      pendingEdit: false, lugar: 'Lote Norte', descripcion: null, objetivoArboles: 12000,
      photoCaptureAllTrees: false, visibleInApp: true,
    });
  });

  test('sin snapshot de foto o visibilidad (edición previa a 0024) los deja como están', async () => {
    await seedLocal({ pendingEdit: true, lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026', visibleInApp: false });

    await discardPlantationEdit(PLANTATION_ID);

    expect((await filaLocal()).visibleInApp).toBe(false);
  });
});
