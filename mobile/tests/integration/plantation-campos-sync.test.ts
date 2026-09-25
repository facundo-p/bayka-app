/**
 * Integration: datos de plantación editables desde mobile (#633). SQLite real
 * (migración 0024): pull con y sin edición pendiente, push de altas y ediciones
 * con los campos nuevos, descartar, y el aviso de duplicado post-sync.
 */
import Database from 'better-sqlite3';
import { conUsuarioCacheado } from '../helpers/rolCacheado';
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
/** Argumentos de cada llamada a `editar_plantacion` (#634). */
const mockEdiciones: { p_id: string; p_cambios: any; p_base: any }[] = [];
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
            if (mockServerState[table].has(row.id)) {
              return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
            }
            mockServerState[table].set(row.id, { ...row });
            return Promise.resolve({ data: null, error: null });
          },
          upsert(row: any) { return Promise.resolve({ data: row, error: null }); },
          update(payload: any) {
            mockUpdates.push({ table, payload });
            return {
              eq: (_col: string, id: string) => {
                const actual = mockServerState[table].get(id);
                if (actual) mockServerState[table].set(id, { ...actual, ...payload });
                const respuesta = Promise.resolve({ data: actual ? [{ id }] : [], error: null });
                return { select: () => respuesta, then: (resolve: any) => respuesta.then(resolve) };
              },
            };
          },
        };
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-admin-1' } } } }),
        getUser: () => Promise.resolve({ data: { user: { id: 'user-admin-1' } } }),
      },
      // `editar_plantacion` como el server: aplica lo que conserva la base, devuelve el resto.
      rpc(nombre: string, args: any) {
        if (nombre !== 'editar_plantacion') return Promise.resolve({ data: { success: true }, error: null });
        mockEdiciones.push(args);
        const actual = mockServerState.plantations.get(args.p_id);
        if (!actual) return Promise.resolve({ data: { success: false, error: 'PLANTACION_INEXISTENTE' }, error: null });
        const aplicar: Record<string, unknown> = {};
        const conflictos: any[] = [];
        for (const [campo, valor] of Object.entries(args.p_cambios)) {
          if (actual[campo] === args.p_base[campo] || actual[campo] === valor) aplicar[campo] = valor;
          else conflictos.push({ campo, valor_servidor: actual[campo], editado_por: 'Ana', editado_en: '2026-09-24T13:12:00Z' });
        }
        if (Object.keys(aplicar).length > 0) mockUpdates.push({ table: 'plantations', payload: aplicar });
        mockServerState.plantations.set(args.p_id, { ...actual, ...aplicar });
        const data = conflictos.length > 0
          ? { success: false, error: 'CONFLICTO_EDICION', aplicados: Object.keys(aplicar), conflictos }
          : { success: true };
        return Promise.resolve({ data, error: null });
      },
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
import { downloadPlantation } from '../../src/services/sync/downloadService';
import { uploadOfflinePlantations, uploadPendingEdits } from '../../src/services/sync/preSteps';
import { discardPlantationEdit, resolverCambios, updatePlantation } from '../../src/repositories/PlantationRepository';
import { camposDeFila } from '../../src/utils/camposDePlantacion';
import { ELECCION } from '../../src/utils/conflictosDeEdicion';

const NetInfo = require('@react-native-community/netinfo');

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
  mockEdiciones.length = 0;
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

  test('si un intento anterior ya insertó el alta, la actualiza con lo editado en el medio', async () => {
    serverPlantation(PLANTATION_ID, { descripcion: 'Primer intento' });
    // El primer intento dejó lo subido como snapshot.
    await seedLocal({
      pendingSync: true, descripcion: 'Editada después',
      lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026', descripcionServer: 'Primer intento',
    });

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado).toMatchObject({ success: true });
    expect(mockEdiciones[0]).toMatchObject({ p_cambios: { descripcion: 'Editada después' }, p_base: { descripcion: 'Primer intento' } });
    expect(mockServerState.plantations.get(PLANTATION_ID).descripcion).toBe('Editada después');
    expect((await filaLocal()).pendingSync).toBe(false);
  });

  test('un alta sin snapshot (versión anterior) no pisa lo distinto del server: queda para resolver', async () => {
    serverPlantation(PLANTATION_ID, { descripcion: 'Cambiada en la web' });
    await seedLocal({ pendingSync: true, descripcion: 'Editada después' });

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado).toMatchObject({ success: true, cambiosPorResolver: 1 });
    expect(mockServerState.plantations.get(PLANTATION_ID).descripcion).toBe('Cambiada en la web');
    expect(await filaLocal()).toMatchObject({
      pendingSync: false, descripcion: 'Cambiada en la web',
      conflictosDeEdicion: [expect.objectContaining({ campo: 'descripcion', mio: 'Editada después' })],
    });
  });

  test('el alta avisa si el server ya tiene otra con el mismo lugar y periodo', async () => {
    await seedLocal({ pendingSync: true, lugar: ' lote norte ', periodo: 'OTOÑO 2026' });
    serverPlantation(OTRA_ID);

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado).toMatchObject({ success: true, duplicada: true });
  });

  test('la edición sube solo lo que cambió, limpia pendingEdit y deja el snapshot con lo subido', async () => {
    await seedLocal({
      pendingEdit: true, lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026',
      objetivoArboles: 15000, objetivoArbolesServer: 12000, visibleInApp: false, visibleInAppServer: true,
    });
    serverPlantation(PLANTATION_ID, { objetivo_arboles: 12000 });

    const [resultado] = await uploadPendingEdits();

    expect(mockUpdates[0].payload).toEqual({ objetivo_arboles: 15000, visible_in_app: false });
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

// ─── Filas previas a 0024 ───────────────────────────────────────────────────

describe('fila sin los campos nuevos pulleados (previa a 0024)', () => {
  const DEL_SERVER = { descripcion: 'Cargada en la web', fecha_inicio: '2026-04-15', objetivo_arboles: 12000 };

  function esperarQueElServerLosConserve() {
    expect(mockServerState.plantations.get(PLANTATION_ID)).toMatchObject({ lugar: 'Campo Sur', ...DEL_SERVER });
  }

  test('editar online solo el lugar no borra descripción, fecha ni objetivo', async () => {
    await seedLocal();
    serverPlantation(PLANTATION_ID, DEL_SERVER);
    const { lugar: _lugar, periodo, ...ajustes } = camposDeFila(await filaLocal());

    await updatePlantation(PLANTATION_ID, 'Campo Sur', periodo, ajustes);

    expect(mockUpdates.map((u) => u.payload)).toEqual([{ lugar: 'Campo Sur' }]);
    esperarQueElServerLosConserve();
  });

  test('una edición offline solo del lugar no borra descripción, fecha ni objetivo', async () => {
    await seedLocal({ pendingEdit: true, lugar: 'Campo Sur', lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026' });
    serverPlantation(PLANTATION_ID, DEL_SERVER);

    const [resultado] = await uploadPendingEdits();

    expect(resultado).toMatchObject({ success: true });
    esperarQueElServerLosConserve();
    expect(await filaLocal()).toMatchObject({ pendingEdit: false, lugarServer: 'Campo Sur', descripcionServer: null });
  });

  test('un pull con edición pendiente trae los campos no editados y el push no los borra', async () => {
    await seedLocal({ pendingEdit: true, lugar: 'Campo Sur', lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026' });
    serverPlantation(PLANTATION_ID, DEL_SERVER);

    await pullFromServer(PLANTATION_ID);
    await uploadPendingEdits();

    expect(mockUpdates.map((u) => u.payload)).toEqual([{ lugar: 'Campo Sur' }]);
    esperarQueElServerLosConserve();
    expect(await filaLocal()).toMatchObject({ lugar: 'Campo Sur', descripcion: 'Cargada en la web', objetivoArboles: 12000 });
  });

  test('re-descargarla con una edición pendiente no rompe el pull: el push no borra nada', async () => {
    await seedLocal({ pendingEdit: true, lugar: 'Campo Sur', lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026' });
    serverPlantation(PLANTATION_ID, { ...DEL_SERVER, organizacion_id: 'org-1', creado_por: 'user-admin-1', created_at: NOW });

    await downloadPlantation(mockServerState.plantations.get(PLANTATION_ID));
    await uploadPendingEdits();

    expect(mockUpdates.map((u) => u.payload)).toEqual([{ lugar: 'Campo Sur' }]);
    esperarQueElServerLosConserve();
  });

  test('un alta a medio subir no pierde lo editado con el pull, y lo sube después', async () => {
    await seedLocal({ pendingSync: true, lugar: 'Campo Sur', descripcion: 'Editada offline' });
    serverPlantation(PLANTATION_ID, { ...DEL_SERVER, descripcion: 'Primer intento' });

    await pullFromServer(PLANTATION_ID);

    expect(await filaLocal()).toMatchObject({
      lugar: 'Campo Sur', descripcion: 'Editada offline', objetivoArboles: 12000, descripcionServer: 'Primer intento',
    });
    await uploadOfflinePlantations();
    expect(mockServerState.plantations.get(PLANTATION_ID)).toMatchObject({
      lugar: 'Campo Sur', descripcion: 'Editada offline', objetivo_arboles: 12000,
    });
  });

  test('sin cambios reales no hay UPDATE', async () => {
    await seedLocal();
    serverPlantation(PLANTATION_ID, DEL_SERVER);
    const { lugar, periodo, ...ajustes } = camposDeFila(await filaLocal());

    await updatePlantation(PLANTATION_ID, lugar, periodo, ajustes);

    expect(mockUpdates).toHaveLength(0);
  });
});

// ─── Re-descarga con alta pendiente (#647) ─────────────────────────────────

describe('re-descargar una plantación con alta pendiente', () => {
  test('downloadPlantation conserva pendingSync y uploadOfflinePlantations la sigue subiendo', async () => {
    await seedLocal({ pendingSync: true, descripcion: 'Editada offline', objetivoArboles: 15000 });
    serverPlantation(PLANTATION_ID, { organizacion_id: 'org-1', creado_por: 'user-admin-1', created_at: NOW });

    await downloadPlantation(mockServerState.plantations.get(PLANTATION_ID));

    expect(await filaLocal()).toMatchObject({ pendingSync: true, descripcion: 'Editada offline', objetivoArboles: 15000 });

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado).toMatchObject({ success: true });
    expect(mockServerState.plantations.get(PLANTATION_ID)).toMatchObject({ descripcion: 'Editada offline', objetivo_arboles: 15000 });
    expect((await filaLocal()).pendingSync).toBe(false);
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

// ─── Conflicto con la web (#634) ────────────────────────────────────────────

describe('edición offline que choca con la web', () => {
  const DATOS = { lugar: 'Lote Norte', periodo: 'Otoño 2026' };

  async function editarOffline(ajustes: Record<string, unknown>) {
    NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });
    await updatePlantation(PLANTATION_ID, DATOS.lugar, DATOS.periodo, ajustes);
  }

  /** Sin señal: objetivo 12.000 → 15.000 y descripción. En la web, objetivo → 12.500. */
  async function llegarAlConflicto() {
    await seedLocal({ objetivoArboles: 12000 });
    serverPlantation(PLANTATION_ID, { objetivo_arboles: 12000 });
    await editarOffline({ objetivoArboles: 15000, descripcion: 'Mía' });
    mockServerState.plantations.get(PLANTATION_ID).objetivo_arboles = 12500;
    await pullFromServer(PLANTATION_ID);
    return (await uploadPendingEdits())[0];
  }

  test('sube con la base de cuando editó aunque el pull haya refrescado el snapshot', async () => {
    await llegarAlConflicto();

    expect(mockEdiciones[0]).toMatchObject({
      p_cambios: { objetivo_arboles: 15000, descripcion: 'Mía' },
      p_base: { objetivo_arboles: 12000, descripcion: null },
    });
  });

  test('queda el valor de la web y el conflicto; lo demás sube', async () => {
    const resultado = await llegarAlConflicto();

    expect(resultado).toMatchObject({ success: true, cambiosPorResolver: 1 });
    expect(mockServerState.plantations.get(PLANTATION_ID)).toMatchObject({ objetivo_arboles: 12500, descripcion: 'Mía' });
    expect(await filaLocal()).toMatchObject({
      pendingEdit: false, objetivoArboles: 12500, descripcion: 'Mía', baseDeEdicion: null,
      conflictosDeEdicion: [expect.objectContaining({
        campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000, editadoPor: 'Ana',
      })],
    });
  });

  test('elegir el propio lo re-encola con la web como base y sube en el próximo sync', async () => {
    await llegarAlConflicto();

    await resolverCambios(PLANTATION_ID, { objetivoArboles: ELECCION.mio });
    expect(await filaLocal()).toMatchObject({ pendingEdit: true, objetivoArboles: 15000, conflictosDeEdicion: null });

    const [resultado] = await uploadPendingEdits();

    expect(mockEdiciones[1]).toMatchObject({ p_cambios: { objetivo_arboles: 15000 }, p_base: { objetivo_arboles: 12500 } });
    expect(resultado).toMatchObject({ cambiosPorResolver: 0 });
    expect(mockServerState.plantations.get(PLANTATION_ID).objetivo_arboles).toBe(15000);
    expect(await filaLocal()).toMatchObject({ pendingEdit: false, objetivoArboles: 15000 });
  });

  test('elegir el de la web descarta el propio sin subir nada', async () => {
    await llegarAlConflicto();

    await resolverCambios(PLANTATION_ID, { objetivoArboles: ELECCION.web });
    await uploadPendingEdits();

    expect(mockEdiciones).toHaveLength(1);
    expect(await filaLocal()).toMatchObject({ pendingEdit: false, objetivoArboles: 12500, conflictosDeEdicion: null });
  });

  test('volver a editar offline un campo en conflicto lo supera y sube con la web como base', async () => {
    await llegarAlConflicto();
    await editarOffline({ objetivoArboles: 16000 });

    expect(await filaLocal()).toMatchObject({ pendingEdit: true, objetivoArboles: 16000, conflictosDeEdicion: null });
    // Un pull en el medio no mueve la base del campo editado.
    await pullFromServer(PLANTATION_ID);
    await uploadPendingEdits();

    expect(mockEdiciones[1]).toMatchObject({ p_cambios: { objetivo_arboles: 16000 }, p_base: { objetivo_arboles: 12500 } });
    expect(mockServerState.plantations.get(PLANTATION_ID).objetivo_arboles).toBe(16000);
    expect((await filaLocal()).conflictosDeEdicion).toBeNull();
  });

  test('varias elecciones se aplican juntas y los campos sin elegir siguen pendientes', async () => {
    await seedLocal({ objetivoArboles: 12000 });
    serverPlantation(PLANTATION_ID, { objetivo_arboles: 12000 });
    await editarOffline({ objetivoArboles: 15000, descripcion: 'Mía', visibleInApp: false });
    Object.assign(mockServerState.plantations.get(PLANTATION_ID), {
      objetivo_arboles: 12500, descripcion: 'Web', visible_in_app: true,
    });
    // visible_in_app no cambió en la web: sube. Chocan objetivo y descripción.
    await uploadPendingEdits();

    await resolverCambios(PLANTATION_ID, { objetivoArboles: ELECCION.mio, descripcion: ELECCION.web });

    expect(await filaLocal()).toMatchObject({
      objetivoArboles: 15000, descripcion: 'Web', pendingEdit: true, conflictosDeEdicion: null,
    });
  });

  test('cambios en campos distintos no chocan', async () => {
    await seedLocal({ objetivoArboles: 12000 });
    serverPlantation(PLANTATION_ID, { objetivo_arboles: 12000 });
    await editarOffline({ objetivoArboles: 12000, descripcion: 'Mía' });
    mockServerState.plantations.get(PLANTATION_ID).objetivo_arboles = 12500;

    const [resultado] = await uploadPendingEdits();

    expect(resultado).toMatchObject({ cambiosPorResolver: 0 });
    expect(mockEdiciones[0].p_cambios).toEqual({ descripcion: 'Mía' });
    expect(mockServerState.plantations.get(PLANTATION_ID)).toMatchObject({ objetivo_arboles: 12500, descripcion: 'Mía' });
  });
});

describe('formulario abierto mientras un pull trae cambios', () => {
  async function abrirFormYPullear() {
    await seedLocal({ descripcion: 'X' });
    serverPlantation(PLANTATION_ID, { descripcion: 'X' });
    const vistos = camposDeFila(await filaLocal());
    mockServerState.plantations.get(PLANTATION_ID).descripcion = 'Y';
    await pullFromServer(PLANTATION_ID);
    return vistos;
  }

  test('guardar sin tocar ese campo no lo pisa', async () => {
    const vistos = await abrirFormYPullear();
    const { lugar: _lugar, periodo, ...ajustes } = vistos;

    await updatePlantation(PLANTATION_ID, 'Campo Sur', periodo, ajustes, vistos);

    expect(mockEdiciones[0].p_cambios).toEqual({ lugar: 'Campo Sur' });
    expect(await filaLocal()).toMatchObject({ lugar: 'Campo Sur', descripcion: 'Y' });
  });

  test('si lo tocó, sube con lo que vio como base y choca con el cambio de la web', async () => {
    const vistos = await abrirFormYPullear();
    const { lugar, periodo, ...ajustes } = vistos;

    const enConflicto = await updatePlantation(PLANTATION_ID, lugar, periodo, { ...ajustes, descripcion: 'Z' }, vistos);

    expect(enConflicto).toBe(1);
    expect(mockEdiciones[0]).toMatchObject({ p_cambios: { descripcion: 'Z' }, p_base: { descripcion: 'X' } });
    expect(await filaLocal()).toMatchObject({
      descripcion: 'Y', conflictosDeEdicion: [expect.objectContaining({ mio: 'Z', web: 'Y', anterior: 'X' })],
    });
  });
});

// El guard de sesión exige que el usuario cacheado sea el de la sesión (#658).
beforeEach(() => conUsuarioCacheado('user-admin-1'));
