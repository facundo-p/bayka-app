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
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import Database from 'better-sqlite3';
import { plantations, parcelas, plantationUsers } from '../../src/database/schema';
import { eq } from 'drizzle-orm';

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

jest.mock('../../src/supabase/client', () => ({
  supabase: { from: jest.fn() },
  isSupabaseConfigured: false,
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
});

afterAll(() => {
  closeTestDb(sqlite);
});

/**
 * drizzle-orm/better-sqlite3's db.transaction() rejects an async callback outright (better-sqlite3
 * native transaction() throws "Transaction function cannot return a promise");
 * createPlantationWithParcelaLocally (PlantationRepository) uses one. Real devices run
 * drizzle-orm/expo-sqlite, which doesn't have this restriction — this shim reproduces that
 * behaviour for the real sqlite instance used here, so the rollback test below exercises the
 * actual insert/rollback logic instead of a mock.
 */
function installAsyncTransactionShim(): void {
  jest.spyOn(mockTestDb, 'transaction').mockImplementation(async (fn: any) => {
    sqlite.exec('BEGIN');
    try {
      const result = await fn(mockTestDb);
      sqlite.exec('COMMIT');
      return result;
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  });
}

/** Arma supabase.from() para que los pasos de push reusados por el modo 'online' (uploadOfflinePlantations + uploadSyncableParcelas) resuelvan en éxito. */
function mockSupabaseForSuccessfulPush() {
  const plantationsInsert = jest.fn().mockResolvedValue({ error: null });
  const parcelasUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'plantations') return { insert: plantationsInsert };
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
  await mockTestDb.delete(parcelas);
  // Antes que plantations: FK plantation_users → plantations sin CASCADE (#67).
  await mockTestDb.delete(plantationUsers);
  await mockTestDb.delete(plantations);
  jest.restoreAllMocks();
  installAsyncTransactionShim();
  (supabase.from as jest.Mock).mockReset();
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
    jest.doMock('../../src/database/client', () => ({ get db() { return mockTestDb; } }));
    jest.doMock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
    jest.doMock('../../src/supabase/client', () => ({ supabase: { from: jest.fn() }, isSupabaseConfigured: false }));
    jest.doMock('../../src/services/SyncService', () => ({ pullFromServer: jest.fn() }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
});
