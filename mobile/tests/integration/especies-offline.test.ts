/**
 * Especies de una plantación ya subida por altas y bajas (#635), contra SQLite real.
 * Offline quedan pendientes; online suben en el momento; el pre-step del sync sube lo
 * pendiente y el pull no lo pisa. Una baja que el server rechaza por árboles vuelve a
 * habilitar la especie en el teléfono.
 *
 * Mock de Supabase: estado in-memory, con un doble de `aplicar_cambios_especies`.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import { plantations, species, plantationSpecies, cambiosEspeciesPendientes } from '../../src/database/schema';
import { plantationSpeciesId } from '../../src/utils/plantationSpeciesId';

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
/** Especies con árboles en el server: su baja se rechaza. */
const mockConArboles = new Set<string>();
const mockRpc = { rechazo: null as string | null, sinRed: false, llamadas: [] as any[] };
const mockNet = { conectado: true };

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: () => Promise.resolve({ isConnected: mockNet.conectado }) },
}));

jest.mock('../../src/supabase/client', () => {
  const filtrar = (tabla: string, filtros: { col: string; value: any }[]) =>
    Array.from(mockServerState[tabla]?.values() ?? []).filter((fila: any) =>
      filtros.every((f) => fila[f.col] === f.value));

  const builder = (tabla: string) => {
    const filtros: { col: string; value: any }[] = [];
    const api: any = {
      select() { return api; },
      eq(col: string, value: any) { filtros.push({ col, value }); return api; },
      in() { return api; },
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

  // Doble de `aplicar_cambios_especies` (058).
  const aplicarCambios = ({ p_plantacion, p_altas, p_bajas }: any) => {
    if (mockRpc.rechazo) return { success: false, error: mockRpc.rechazo };
    const clave = (s: string) => `${p_plantacion}|${s}`;
    for (const s of p_altas) mockServerState.plantation_species.set(clave(s), { plantation_id: p_plantacion, species_id: s, orden_visual: 0 });
    const rechazadas: any[] = [];
    for (const s of p_bajas) {
      if (p_altas.includes(s)) continue;
      if (mockConArboles.has(s)) rechazadas.push({ species_id: s, error: 'ESPECIE_CON_ARBOLES' });
      else mockServerState.plantation_species.delete(clave(s));
    }
    return { success: true, rechazadas };
  };

  return {
    supabase: {
      from: (tabla: string) => ({
        select: () => builder(tabla),
        insert: (fila: any) => {
          mockServerState[tabla]?.set(fila.id, fila);
          return Promise.resolve({ error: null });
        },
      }),
      rpc: (nombre: string, args: any) => {
        if (nombre !== 'aplicar_cambios_especies') return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
        mockRpc.llamadas.push(args);
        if (mockRpc.sinRed) return Promise.resolve({ data: null, error: { message: 'TypeError: Network request failed' } });
        return Promise.resolve({ data: aplicarCambios(args), error: null });
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-admin-1' } } } }),
      },
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

import { guardarEspeciesDePlantacion } from '../../src/services/EspeciesDePlantacionService';
import { uploadPendingSpeciesChanges } from '../../src/services/sync/cambiosDeEspecies';
import { uploadOfflinePlantations } from '../../src/services/sync/preSteps';
import { pullFromServer } from '../../src/services/sync/pullService';
import { getResumenDePendientes } from '../../src/queries/catalogQueries';

const PLANTACION_ID = 'plant-1';
const ROBLE = 'sp-roble';
const PINO = 'sp-pino';
const ALAMO = 'sp-alamo';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

const filaServer = (s: string) => ({ plantation_id: PLANTACION_ID, species_id: s, orden_visual: 0 });

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();
  mockConArboles.clear();
  Object.assign(mockRpc, { rechazo: null, sinRed: false, llamadas: [] });
  mockNet.conectado = true;
  await vaciarTablas(mockTestDb);

  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION_ID, lugar: 'Campo', periodo: '2026' }));
  await mockTestDb.insert(species).values([ROBLE, PINO, ALAMO].map((id) => ({
    id, codigo: id.toUpperCase(), nombre: id, nombreCientifico: null, createdAt: '2026-01-01T00:00:00',
  })));
  // Roble y pino habilitadas en los dos lados.
  await mockTestDb.insert(plantationSpecies).values([ROBLE, PINO].map((especieId) => ({
    id: plantationSpeciesId(PLANTACION_ID, especieId), plantacionId: PLANTACION_ID, especieId,
  })));
  for (const s of [ROBLE, PINO]) serverState.plantation_species.set(`${PLANTACION_ID}|${s}`, filaServer(s));
  serverState.plantations.set(PLANTACION_ID, {
    id: PLANTACION_ID, lugar: 'Campo', periodo: '2026', estado: 'activa',
    creado_por: 'user-admin-1', created_at: '2026-01-01T00:00:00', visible_in_app: true,
  });
  serverState.plantation_users.set('user-admin-1', {
    plantation_id: PLANTACION_ID, user_id: 'user-admin-1', rol_en_plantacion: 'admin', assigned_at: '2026-01-01T00:00:00',
  });
});

const localesHabilitadas = async () =>
  (await mockTestDb.select().from(plantationSpecies).where(eq(plantationSpecies.plantacionId, PLANTACION_ID)))
    .map((ps) => ps.especieId).sort();
const pendientes = async () =>
  (await mockTestDb.select().from(cambiosEspeciesPendientes)).map((c) => `${c.tipo}:${c.especieId}`).sort();
const delServer = () => Array.from(serverState.plantation_species.values()).map((f) => f.species_id).sort();

describe('guardar especies', () => {
  it('offline: se aplica en el teléfono y queda pendiente', async () => {
    mockNet.conectado = false;
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [PINO] });

    expect(await localesHabilitadas()).toEqual([ALAMO, ROBLE].sort());
    expect(await pendientes()).toEqual([`alta:${ALAMO}`, `baja:${PINO}`].sort());
    expect(mockRpc.llamadas).toHaveLength(0);
    expect((await getResumenDePendientes(PLANTACION_ID)).especies).toBe(2);
  });

  it('online: sube en el momento con altas y bajas, y no queda nada pendiente', async () => {
    const conArboles = await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [PINO] });

    expect(conArboles).toEqual([]);
    expect(mockRpc.llamadas).toEqual([{ p_plantacion: PLANTACION_ID, p_altas: [ALAMO], p_bajas: [PINO] }]);
    expect(delServer()).toEqual([ALAMO, ROBLE].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('una baja con árboles en el server vuelve a habilitarse y se devuelve su nombre', async () => {
    mockConArboles.add(PINO);
    const conArboles = await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [PINO] });

    expect(conArboles).toEqual([{ especieId: PINO, nombre: PINO }]);
    expect(await localesHabilitadas()).toEqual([ALAMO, PINO, ROBLE].sort());
    expect(delServer()).toEqual([ALAMO, PINO, ROBLE].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('la plantación no admite el cambio: se deshace en el teléfono y avisa', async () => {
    mockRpc.rechazo = 'PLANTACION_ARCHIVADA';
    await expect(guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [PINO] }))
      .rejects.toThrow('La plantación está archivada y no acepta cambios. Los cambios no se guardaron.');

    expect(await localesHabilitadas()).toEqual([PINO, ROBLE].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('un rechazo de la plantación deshace solo este guardado: lo pendiente de antes sigue', async () => {
    mockNet.conectado = false;
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [], bajas: [PINO] });
    // La web finalizó la plantación mientras tanto.
    mockNet.conectado = true;
    mockRpc.rechazo = 'PLANTACION_FINALIZADA';

    await expect(guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [] })).rejects.toThrow();

    expect(await localesHabilitadas()).toEqual([ROBLE]);
    expect(await pendientes()).toEqual([`baja:${PINO}`]);
  });

  it('deshacer un guardado que pisó un pendiente contrario lo restaura', async () => {
    mockNet.conectado = false;
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [], bajas: [PINO] });
    mockNet.conectado = true;
    mockRpc.rechazo = 'PLANTACION_FINALIZADA';

    await expect(guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [PINO], bajas: [] })).rejects.toThrow();

    expect(await localesHabilitadas()).toEqual([ROBLE]);
    expect(await pendientes()).toEqual([`baja:${PINO}`]);
  });

  it('online pero sin respuesta: queda pendiente, sin error', async () => {
    mockRpc.sinRed = true;
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [] });

    expect(await localesHabilitadas()).toEqual([ALAMO, PINO, ROBLE].sort());
    expect(await pendientes()).toEqual([`alta:${ALAMO}`]);
  });

  it('una plantación sin subir anota solo las bajas: su alta sube todas las especies', async () => {
    await mockTestDb.update(plantations).set({ pendingSync: true }).where(eq(plantations.id, PLANTACION_ID));
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [PINO] });

    expect(await localesHabilitadas()).toEqual([ALAMO, ROBLE].sort());
    expect(await pendientes()).toEqual([`baja:${PINO}`]);
    expect(mockRpc.llamadas).toHaveLength(0);
  });

  it('una baja de una plantación sin subir viaja con su alta: si un intento anterior ya subió la especie, se quita', async () => {
    // Un intento anterior subió la plantación con roble y pino, y se perdió la respuesta.
    await mockTestDb.update(plantations).set({ pendingSync: true }).where(eq(plantations.id, PLANTACION_ID));
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [], bajas: [PINO] });

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado.success).toBe(true);
    expect(mockRpc.llamadas).toEqual([{ p_plantacion: PLANTACION_ID, p_altas: [ROBLE], p_bajas: [PINO] }]);
    expect(delServer()).toEqual([ROBLE]);
    expect(await pendientes()).toEqual([]);
  });

  it('una baja de una plantación sin subir que el server rechaza por árboles vuelve y el resumen avisa', async () => {
    await mockTestDb.update(plantations).set({ pendingSync: true }).where(eq(plantations.id, PLANTACION_ID));
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [], bajas: [PINO] });
    mockConArboles.add(PINO);

    const [resultado] = await uploadOfflinePlantations();

    expect(resultado).toMatchObject({ success: true, especiesConArboles: [PINO] });
    expect(await localesHabilitadas()).toEqual([PINO, ROBLE].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('una plantación que ya subió anota el alta aunque la pantalla se haya abierto antes del sync', async () => {
    // La pantalla la vio sin subir; SQLite ya la tiene subida: manda SQLite.
    mockNet.conectado = false;
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [] });

    expect(await pendientes()).toEqual([`alta:${ALAMO}`]);
  });

  it('el último cambio sobre una especie gana', async () => {
    mockNet.conectado = false;
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [], bajas: [PINO] });
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [PINO], bajas: [] });

    expect(await pendientes()).toEqual([`alta:${PINO}`]);
  });
});

describe('sync', () => {
  async function cambiarOffline() {
    mockNet.conectado = false;
    await guardarEspeciesDePlantacion(PLANTACION_ID, { altas: [ALAMO], bajas: [PINO] });
  }

  it('el pull no borra un alta pendiente ni devuelve una baja pendiente', async () => {
    await cambiarOffline();
    await pullFromServer(PLANTACION_ID);

    expect(await localesHabilitadas()).toEqual([ALAMO, ROBLE].sort());
  });

  it('cambios en especies distintas desde la web y el teléfono se aplican los dos', async () => {
    await cambiarOffline();
    // La web, mientras tanto, quitó el roble.
    serverState.plantation_species.delete(`${PLANTACION_ID}|${ROBLE}`);

    expect(await uploadPendingSpeciesChanges()).toEqual([]);
    await pullFromServer(PLANTACION_ID);

    expect(delServer()).toEqual([ALAMO]);
    expect(await localesHabilitadas()).toEqual([ALAMO]);
    expect(await pendientes()).toEqual([]);
  });

  it('una baja rechazada por árboles re-habilita la especie y el resumen lo avisa', async () => {
    await cambiarOffline();
    mockConArboles.add(PINO);

    expect(await uploadPendingSpeciesChanges()).toEqual([
      { success: true, plantacionId: PLANTACION_ID, nombre: 'Campo', especiesConArboles: [PINO] },
    ]);
    expect(await localesHabilitadas()).toEqual([ALAMO, PINO, ROBLE].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('una plantación que no admite el cambio lo conserva pendiente para otro sync', async () => {
    await cambiarOffline();
    mockRpc.rechazo = 'PLANTACION_FINALIZADA';

    expect(await uploadPendingSpeciesChanges()).toEqual([]);
    expect(await pendientes()).toEqual([`alta:${ALAMO}`, `baja:${PINO}`].sort());
    expect(await localesHabilitadas()).toEqual([ALAMO, ROBLE].sort());
  });
});
