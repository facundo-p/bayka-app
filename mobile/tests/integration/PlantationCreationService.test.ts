/**
 * Integration tests: PlantationCreationService.createPlantationWithDefaultParcela
 *
 * Real SQLite via better-sqlite3 + drizzle migrations; mocks `database/client` so the service +
 * repositories operate on the in-memory test DB. Local-first (#300): plantation + parcela +
 * membership are always created in ONE local transaction regardless of mode; 'online' additionally
 * triggers a best-effort push via the real sync steps (mocked only at the supabase boundary) —
 * same local path either way, only the push-after differs.
 * Lives under tests/integration/ because it needs the integration jest config to resolve
 * better-sqlite3.
 */
import { createTestDb, closeTestDb, vaciarTablas, sqliteDeIntegracion, IntegrationDb } from '../helpers/integrationDb';
import Database from 'better-sqlite3';
import { plantations, parcelas, plantationUsers } from '../../src/database/schema';
import { eq } from 'drizzle-orm';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
  // `enTransaccion` abre la transacción por acá: sin esto caería a escribir sin
  // transacción y el test de rollback pasaría a no probar nada.
  get sqlite() {
    return mockSqliteDeIntegracion;
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/supabase/client', () => ({
  supabase: { from: jest.fn() },
  isSupabaseConfigured: false,
}));

const mockSesion = { vencida: false };
jest.mock('../../src/services/sync/sessionGuard', () => ({
  ensureServerSession: () => (mockSesion.vencida ? Promise.reject(new Error('SESSION_EXPIRED')) : Promise.resolve()),
}));

jest.mock('../../src/services/SyncService', () => ({
  pullFromServer: jest.fn(),
}));

// Default: feature flag ON.
jest.mock('../../src/config/featureFlags', () => ({
  AUTO_PARCELA_DEFAULT: true,
}));

import { createPlantationWithDefaultParcela } from '../../src/services/PlantationCreationService';
import { supabase } from '../../src/supabase/client';
import { syncLog } from '../../src/utils/syncLogger';

const baseParams = {
  lugar: 'Campo Test',
  periodo: '2026-otono',
  organizacionId: '00000000-0000-0000-0000-000000000001',
  creadoPor: 'user-admin-1',
  mode: 'offline' as const,
};

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => {
  closeTestDb(sqlite);
});

/**
 * Arma supabase.from() para que los pasos de push reusados por el modo 'online'
 * (uploadOfflinePlantations + uploadSyncableParcelas) resuelvan en éxito. `duplicadaCount`
 * simula cuántas otras plantaciones con el mismo lugar/periodo ve el chequeo de #633/#655
 * (hayOtraEnServidor, .select().ilike().ilike().neq()); default 0 = sin duplicado.
 */
function mockSupabaseForSuccessfulPush(opts?: { duplicadaCount?: number }) {
  const plantationsInsert = jest.fn().mockResolvedValue({ error: null });
  const parcelasUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
  const duplicadaChain = {
    ilike: jest.fn().mockReturnThis(),
    neq: jest.fn().mockResolvedValue({ count: opts?.duplicadaCount ?? 0, error: null }),
  };
  const plantationsSelect = jest.fn().mockReturnValue(duplicadaChain);
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'plantations') return { insert: plantationsInsert, select: plantationsSelect };
    if (table === 'parcelas') return { upsert: parcelasUpsert };
    throw new Error(`unexpected table in test: ${table}`);
  });
  return { plantationsInsert, parcelasUpsert };
}

/** Simula caída de red: cualquier llamada a supabase.from() explota — cubre tanto el insert de plantación como el upsert de parcela del push. */
function mockSupabaseForFailedPush(): void {
  (supabase.from as jest.Mock).mockImplementation(() => {
    throw new Error('Network request failed');
  });
}

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  jest.restoreAllMocks();
  (supabase.from as jest.Mock).mockReset();
  mockSesion.vencida = false;
});

describe('createPlantationWithDefaultParcela — local-first (offline)', () => {
  test('flag ON + offline → crea plantación + parcela "Parcela 1"/"P1" + membresía admin, todo pendingSync=true, sin llamar a supabase', async () => {
    const r = await createPlantationWithDefaultParcela(baseParams);

    expect(r.id).toBeTruthy();
    const plantationRows = await mockTestDb.select().from(plantations).where(eq(plantations.id, r.id));
    expect(plantationRows).toHaveLength(1);
    expect(plantationRows[0].pendingSync).toBe(true);

    const parcelaRows = await mockTestDb.select().from(parcelas).where(eq(parcelas.plantacionId, r.id));
    expect(parcelaRows).toHaveLength(1);
    expect(parcelaRows[0].nombre).toBe('Parcela 1');
    expect(parcelaRows[0].codigo).toBe('P1');
    expect(parcelaRows[0].descripcion).toBeNull();
    expect(parcelaRows[0].pendingSync).toBe(true);

    const membresias = await mockTestDb.select().from(plantationUsers).where(eq(plantationUsers.plantationId, r.id));
    expect(membresias).toHaveLength(1);
    expect(membresias[0]).toMatchObject({ userId: 'user-admin-1', rolEnPlantacion: 'admin' });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('idempotencia: dos invocaciones producen 2 plantaciones + 2 parcelas distintas', async () => {
    const r1 = await createPlantationWithDefaultParcela(baseParams);
    const r2 = await createPlantationWithDefaultParcela({ ...baseParams, lugar: 'Campo Sur' });
    expect(r1.id).not.toBe(r2.id);
    const allPlantations = await mockTestDb.select().from(plantations);
    expect(allPlantations).toHaveLength(2);
    const allParcelas = await mockTestDb.select().from(parcelas);
    expect(allParcelas).toHaveLength(2);
    expect(allParcelas.every((p) => p.codigo === 'P1' && p.nombre === 'Parcela 1')).toBe(true);
  });

  test('flag OFF → solo crea plantación, 0 parcelas', async () => {
    jest.resetModules();
    jest.doMock('../../src/config/featureFlags', () => ({ AUTO_PARCELA_DEFAULT: false }));
    // Re-establish mocks for the fresh module registry.
    jest.doMock('../../src/database/client', () => ({
      get db() { return mockTestDb; },
      get sqlite() { return mockSqliteDeIntegracion; },
    }));
    jest.doMock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
    jest.doMock('../../src/supabase/client', () => ({ supabase: { from: jest.fn() }, isSupabaseConfigured: false }));
    jest.doMock('../../src/services/SyncService', () => ({ pullFromServer: jest.fn() }));
    const mod = require('../../src/services/PlantationCreationService');
    const r = await mod.createPlantationWithDefaultParcela(baseParams);
    expect(r.id).toBeTruthy();
    const plantationRows = await mockTestDb.select().from(plantations).where(eq(plantations.id, r.id));
    expect(plantationRows).toHaveLength(1);
    const parcelaRows = await mockTestDb.select().from(parcelas);
    expect(parcelaRows).toHaveLength(0);
  });

  test('la parcela default falla al insertar (SQLite) → rollback de la transacción, no persiste NADA (ni plantación ni membresía)', async () => {
    const originalInsert = mockTestDb.insert.bind(mockTestDb);
    jest.spyOn(mockTestDb, 'insert').mockImplementation((table: any) => {
      if (table === parcelas) {
        return { values: () => Promise.reject(new Error('SQLITE_CONSTRAINT')) } as any;
      }
      return originalInsert(table);
    });

    await expect(createPlantationWithDefaultParcela(baseParams)).rejects.toThrow('SQLITE_CONSTRAINT');

    const allPlantations = await mockTestDb.select().from(plantations);
    expect(allPlantations).toHaveLength(0);
    const allMemberships = await mockTestDb.select().from(plantationUsers);
    expect(allMemberships).toHaveLength(0);
  });
});

describe('createPlantationWithDefaultParcela — modo online (push inmediato)', () => {
  const onlineParams = { ...baseParams, mode: 'online' as const };

  test('push exitoso → sube plantación + parcela una sola vez, quedan sincronizadas localmente', async () => {
    const { plantationsInsert, parcelasUpsert } = mockSupabaseForSuccessfulPush();

    const r = await createPlantationWithDefaultParcela(onlineParams);

    expect(plantationsInsert).toHaveBeenCalledTimes(1);
    expect(parcelasUpsert).toHaveBeenCalledTimes(1);

    const [plantationRow] = await mockTestDb.select().from(plantations).where(eq(plantations.id, r.id));
    expect(plantationRow.pendingSync).toBe(false);

    const [parcelaRow] = await mockTestDb.select().from(parcelas).where(eq(parcelas.plantacionId, r.id));
    expect(parcelaRow.pendingSync).toBe(false);
  });

  test('push falla (red) → NO throwea; plantación y parcela quedan pendingSync=true para el próximo sync', async () => {
    mockSupabaseForFailedPush();
    const errorSpy = jest.spyOn(syncLog, 'error').mockImplementation(() => {});

    const r = await createPlantationWithDefaultParcela(onlineParams);

    expect(r.id).toBeTruthy();
    const [plantationRow] = await mockTestDb.select().from(plantations).where(eq(plantations.id, r.id));
    expect(plantationRow.pendingSync).toBe(true);
    const [parcelaRow] = await mockTestDb.select().from(parcelas).where(eq(parcelas.plantacionId, r.id));
    expect(parcelaRow.pendingSync).toBe(true);
    // El fallo se loguea (en uploadOfflinePlantations, reusado tal cual), nunca se propaga al caller.
    expect(errorSpy).toHaveBeenCalled();
  });

  test('sin sesión válida no intenta subir: iría como anon y RLS lo leería como falta de permiso (#638)', async () => {
    const { plantationsInsert } = mockSupabaseForSuccessfulPush();
    mockSesion.vencida = true;
    jest.spyOn(syncLog, 'error').mockImplementation(() => {});

    const r = await createPlantationWithDefaultParcela(onlineParams);

    expect(plantationsInsert).not.toHaveBeenCalled();
    const [plantationRow] = await mockTestDb.select().from(plantations).where(eq(plantations.id, r.id));
    expect(plantationRow).toMatchObject({ pendingSync: true, motivoVarado: null });
  });

  test('un 42501 fuera de una sync no deja la plantación varada: la próxima sync lo reintenta (#638)', async () => {
    (supabase.from as jest.Mock).mockImplementation(() => ({
      insert: jest.fn().mockResolvedValue({ error: { code: '42501', message: 'rls' } }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));
    jest.spyOn(syncLog, 'error').mockImplementation(() => {});

    const r = await createPlantationWithDefaultParcela(onlineParams);

    const [plantationRow] = await mockTestDb.select().from(plantations).where(eq(plantations.id, r.id));
    expect(plantationRow).toMatchObject({ pendingSync: true, motivoVarado: null });
  });
});

describe('createPlantationWithDefaultParcela — duplicada en servidor (#655)', () => {
  const onlineParams = { ...baseParams, mode: 'online' as const };

  test('el server ya tiene otra con mismo lugar y periodo → duplicada:true', async () => {
    mockSupabaseForSuccessfulPush({ duplicadaCount: 1 });

    const r = await createPlantationWithDefaultParcela(onlineParams);

    expect(r.duplicada).toBe(true);
  });

  test('sin coincidencias en el server → duplicada:false', async () => {
    mockSupabaseForSuccessfulPush({ duplicadaCount: 0 });

    const r = await createPlantationWithDefaultParcela(onlineParams);

    expect(r.duplicada).toBe(false);
  });

  test('modo offline: no pushea, no chequea duplicado', async () => {
    const r = await createPlantationWithDefaultParcela(baseParams);

    expect(r.duplicada).toBeUndefined();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('push falla (red) → duplicada:false, la plantación queda pendingSync para reintentar', async () => {
    mockSupabaseForFailedPush();
    jest.spyOn(syncLog, 'error').mockImplementation(() => {});

    const r = await createPlantationWithDefaultParcela(onlineParams);

    expect(r.duplicada).toBe(false);
  });
});
