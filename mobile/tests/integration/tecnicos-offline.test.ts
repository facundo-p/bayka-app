/**
 * Técnicos de una plantación asignables sin conexión (#636), contra SQLite real.
 * Asignar se aplica en el teléfono y queda pendiente; con señal sube en el momento; el
 * pre-step del sync sube lo pendiente y el pull no lo borra. Un técnico que el server
 * rechaza se quita del teléfono y se avisa. Quitar a alguien del server requiere señal.
 *
 * Mock de Supabase: estado in-memory, con un doble de `aplicar_cambios_tecnicos`.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import { plantations, plantationUsers, altasDeTecnicosPendientes, tecnicosDeOrganizacion } from '../../src/database/schema';

const mockServerState: Record<string, Map<string, any>> = {
  plantations: new Map(),
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
  species: new Map(),
  profiles: new Map(),
};
const serverState = mockServerState;
/** Técnicos que el server rechaza: dados de baja. */
const mockInactivos = new Set<string>();
const mockRpc = { rechazo: null as string | null, sinRed: false, colgado: false, llamadas: [] as any[] };
const mockNet = { conectado: true };

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: () => Promise.resolve({ isConnected: mockNet.conectado }) },
}));

jest.mock('../../src/supabase/auth', () => ({ readCachedRole: () => Promise.resolve('admin') }));

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

  // Doble de `aplicar_cambios_tecnicos` (059).
  const aplicarCambios = ({ p_plantacion, p_altas, p_bajas }: any) => {
    if (mockRpc.rechazo) return { success: false, error: mockRpc.rechazo };
    const rechazados: any[] = [];
    for (const u of p_altas) {
      if (mockInactivos.has(u)) { rechazados.push({ user_id: u, error: 'TECNICO_INACTIVO' }); continue; }
      mockServerState.plantation_users.set(u, {
        plantation_id: p_plantacion, user_id: u, rol_en_plantacion: 'tecnico', assigned_at: '2026-02-01T00:00:00',
      });
    }
    for (const u of p_bajas) if (!p_altas.includes(u)) mockServerState.plantation_users.delete(u);
    return { success: true, rechazados };
  };

  return {
    supabase: {
      from: (tabla: string) => ({ select: () => builder(tabla) }),
      rpc: (nombre: string, args: any) => {
        if (nombre !== 'aplicar_cambios_tecnicos') return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
        mockRpc.llamadas.push(args);
        if (mockRpc.sinRed) return Promise.resolve({ data: null, error: { message: 'TypeError: Network request failed' } });
        if (mockRpc.colgado) return new Promise(() => {});
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
jest.mock('../../src/services/PhotoService', () => ({
  ...jest.requireActual('../../src/services/PhotoService'),
  borrarFotosLocales: jest.fn(),
}));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import {
  ESPERA_DE_SUBIDA_MS,
  guardarTecnicosDePlantacion,
  refrescarTecnicosDeOrganizacion,
} from '../../src/services/TecnicosDePlantacionService';
import { uploadPendingTechnicianAssignments } from '../../src/services/sync/tecnicosDePlantacion';
import { pullFromServer } from '../../src/services/sync/pullService';
import { getResumenDePendientes } from '../../src/queries/catalogQueries';
import { getTechniciansWithAssignment } from '../../src/queries/adminQueries';
import { deletePlantationLocally } from '../../src/repositories/PlantationRepository';

const PLANTACION_ID = 'plant-1';
const ORG = 'org-1';
const ANA = 'tec-ana';
const BRUNO = 'tec-bruno';
const CARLA = 'tec-carla';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

const perfil = (id: string, nombre: string) => ({ id, nombre, organizacion_id: ORG, rol: 'tecnico', activo: true });
const miembro = (userId: string, rol: string) => ({
  plantation_id: PLANTACION_ID, user_id: userId, rol_en_plantacion: rol, assigned_at: '2026-01-01T00:00:00',
});

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();
  mockInactivos.clear();
  Object.assign(mockRpc, { rechazo: null, sinRed: false, colgado: false, llamadas: [] });
  mockNet.conectado = true;
  await vaciarTablas(mockTestDb);

  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION_ID, lugar: 'Campo', periodo: '2026' }));
  // Ana ya asignada en los dos lados.
  await mockTestDb.insert(plantationUsers).values([
    { plantationId: PLANTACION_ID, userId: 'user-admin-1', rolEnPlantacion: 'admin', assignedAt: '2026-01-01T00:00:00' },
    { plantationId: PLANTACION_ID, userId: ANA, rolEnPlantacion: 'tecnico', assignedAt: '2026-01-01T00:00:00' },
  ]);
  serverState.plantation_users.set('user-admin-1', miembro('user-admin-1', 'admin'));
  serverState.plantation_users.set(ANA, miembro(ANA, 'tecnico'));
  for (const [id, nombre] of [[ANA, 'Ana'], [BRUNO, 'Bruno'], [CARLA, 'Carla']]) serverState.profiles.set(id, perfil(id, nombre));
  serverState.plantations.set(PLANTACION_ID, {
    id: PLANTACION_ID, lugar: 'Campo', periodo: '2026', estado: 'activa',
    creado_por: 'user-admin-1', created_at: '2026-01-01T00:00:00', visible_in_app: true,
  });
  await refrescarTecnicosDeOrganizacion();
});

const tecnicosLocales = async () =>
  (await mockTestDb.select().from(plantationUsers).where(eq(plantationUsers.rolEnPlantacion, 'tecnico')))
    .map((pu) => pu.userId).sort();
const pendientes = async () => (await mockTestDb.select().from(altasDeTecnicosPendientes)).map((a) => a.userId).sort();
const delServer = () => Array.from(serverState.plantation_users.values())
  .filter((f) => f.rol_en_plantacion === 'tecnico').map((f) => f.user_id).sort();

describe('caché de técnicos', () => {
  it('el refresco guarda los técnicos activos de la organización', async () => {
    const cache = await mockTestDb.select().from(tecnicosDeOrganizacion);
    expect(cache.map((t) => t.nombre).sort()).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  it('sin conexión la pantalla lee del caché, con las altas pendientes marcadas', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });

    expect(await getTechniciansWithAssignment(ORG, PLANTACION_ID)).toEqual([
      { id: ANA, nombre: 'Ana', assigned: true, pendiente: false },
      { id: BRUNO, nombre: 'Bruno', assigned: true, pendiente: true },
      { id: CARLA, nombre: 'Carla', assigned: false, pendiente: false },
    ]);
  });
});

describe('técnico que salió del caché', () => {
  async function darDeBaja(id: string) {
    serverState.profiles.delete(id);
    await refrescarTecnicosDeOrganizacion();
  }

  it('su alta pendiente se sigue viendo con el nombre de cuando se asignó, y se puede deshacer', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [CARLA], bajas: [] });
    mockNet.conectado = true;
    mockRpc.sinRed = true;
    await darDeBaja(CARLA);

    expect(await getTechniciansWithAssignment(ORG, PLANTACION_ID)).toContainEqual(
      { id: CARLA, nombre: 'Carla', assigned: true, pendiente: true },
    );
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [], bajas: [CARLA] });
    expect(await pendientes()).toEqual([]);
  });

  it('el aviso del rechazo lo nombra con el nombre guardado', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [CARLA], bajas: [] });
    mockNet.conectado = true;
    await darDeBaja(CARLA);
    mockInactivos.add(CARLA);

    expect(await uploadPendingTechnicianAssignments()).toEqual([
      { success: true, plantacionId: PLANTACION_ID, nombre: 'Campo', tecnicosNoAsignados: ['Carla'] },
    ]);
  });
});

describe('señal débil', () => {
  afterEach(() => jest.useRealTimers());

  it('si el server no responde a tiempo, guardar vuelve igual y el alta queda pendiente', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockRpc.colgado = true;
    const guardado = guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });
    await jest.advanceTimersByTimeAsync(ESPERA_DE_SUBIDA_MS);

    expect(await guardado).toEqual([]);
    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
    expect(await pendientes()).toEqual([BRUNO]);
  });
});

describe('guardar técnicos', () => {
  it('offline: se asigna en el teléfono y queda pendiente', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });

    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
    expect(await pendientes()).toEqual([BRUNO]);
    expect(mockRpc.llamadas).toHaveLength(0);
    expect((await getResumenDePendientes(PLANTACION_ID)).tecnicos).toBe(1);
  });

  it('online: sube en el momento y no queda nada pendiente', async () => {
    expect(await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] })).toEqual([]);

    expect(mockRpc.llamadas).toEqual([{ p_plantacion: PLANTACION_ID, p_altas: [BRUNO], p_bajas: [] }]);
    expect(delServer()).toEqual([ANA, BRUNO].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('un técnico que el server rechaza se quita del teléfono y se devuelve su nombre', async () => {
    mockInactivos.add(CARLA);
    expect(await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO, CARLA], bajas: [] })).toEqual(['Carla']);

    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('online pero sin respuesta: queda pendiente, sin error', async () => {
    mockRpc.sinRed = true;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });

    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
    expect(await pendientes()).toEqual([BRUNO]);
  });

  it('la plantación no admite el cambio: se deshace en el teléfono y avisa', async () => {
    mockRpc.rechazo = 'PLANTACION_ARCHIVADA';
    await expect(guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] }))
      .rejects.toThrow('La plantación está archivada y no acepta cambios. Los cambios no se guardaron.');

    expect(await tecnicosLocales()).toEqual([ANA]);
    expect(await pendientes()).toEqual([]);
  });

  it('el rechazo con señal deshace solo este guardado: lo pendiente de antes sigue pendiente', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });
    mockNet.conectado = true;
    mockRpc.rechazo = 'PLANTACION_ARCHIVADA';
    await expect(guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [CARLA], bajas: [] })).rejects.toThrow();

    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
    expect(await pendientes()).toEqual([BRUNO]);
  });

  it('quitar a un técnico del server sube la baja con las altas pendientes', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });
    mockNet.conectado = true;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [], bajas: [ANA] });

    expect(mockRpc.llamadas).toEqual([{ p_plantacion: PLANTACION_ID, p_altas: [BRUNO], p_bajas: [ANA] }]);
    expect(delServer()).toEqual([BRUNO]);
    expect(await tecnicosLocales()).toEqual([BRUNO]);
    expect(await pendientes()).toEqual([]);
  });

  it('quitar a un técnico del server sin conexión no toca nada y avisa', async () => {
    mockNet.conectado = false;
    await expect(guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [ANA] }))
      .rejects.toThrow('Quitar técnicos requiere conexión a internet. Los cambios no se guardaron.');

    expect(await tecnicosLocales()).toEqual([ANA]);
    expect(await pendientes()).toEqual([]);
  });

  it('quitar un alta que no subió solo la descarta, también sin conexión', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [], bajas: [BRUNO] });

    expect(await tecnicosLocales()).toEqual([ANA]);
    expect(await pendientes()).toEqual([]);
    expect(mockRpc.llamadas).toHaveLength(0);
  });

  it('una plantación sin subir espera a su alta: no llama al server', async () => {
    await mockTestDb.update(plantations).set({ pendingSync: true }).where(eq(plantations.id, PLANTACION_ID));
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });

    expect(await pendientes()).toEqual([BRUNO]);
    expect(mockRpc.llamadas).toHaveLength(0);
    expect(await uploadPendingTechnicianAssignments()).toEqual([]);
    expect(mockRpc.llamadas).toHaveLength(0);
  });

  it('eliminar la plantación del dispositivo descarta sus altas pendientes', async () => {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: [BRUNO], bajas: [] });
    await deletePlantationLocally(PLANTACION_ID);

    expect(await pendientes()).toEqual([]);
  });
});

describe('sync', () => {
  async function asignarOffline(...ids: string[]) {
    mockNet.conectado = false;
    await guardarTecnicosDePlantacion(PLANTACION_ID, { altas: ids, bajas: [] });
    mockNet.conectado = true;
  }

  it('el pull no borra un alta pendiente', async () => {
    await asignarOffline(BRUNO);
    await pullFromServer(PLANTACION_ID);

    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
  });

  it('el pre-step sube las altas; lo que la web asignó en el medio no se pisa', async () => {
    await asignarOffline(BRUNO);
    serverState.plantation_users.set(CARLA, miembro(CARLA, 'tecnico'));

    expect(await uploadPendingTechnicianAssignments()).toEqual([]);
    await pullFromServer(PLANTACION_ID);

    expect(delServer()).toEqual([ANA, BRUNO, CARLA].sort());
    expect(await tecnicosLocales()).toEqual([ANA, BRUNO, CARLA].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('un técnico rechazado se descarta y el resumen del sync lo avisa', async () => {
    await asignarOffline(BRUNO, CARLA);
    mockInactivos.add(CARLA);

    expect(await uploadPendingTechnicianAssignments()).toEqual([
      { success: true, plantacionId: PLANTACION_ID, nombre: 'Campo', tecnicosNoAsignados: ['Carla'] },
    ]);
    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
    expect(await pendientes()).toEqual([]);
  });

  it('una plantación que no admite el cambio lo conserva pendiente para otro sync', async () => {
    await asignarOffline(BRUNO);
    mockRpc.rechazo = 'PLANTACION_ARCHIVADA';

    expect(await uploadPendingTechnicianAssignments()).toEqual([]);
    expect(await pendientes()).toEqual([BRUNO]);
    expect(await tecnicosLocales()).toEqual([ANA, BRUNO].sort());
  });
});
