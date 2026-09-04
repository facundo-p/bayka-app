/**
 * Integration tests: PlantationCreationService.createPlantationWithDefaultParcela
 *
 * Real SQLite via better-sqlite3 + drizzle migrations; mocks `database/client`
 * so the service + repositories operate on the in-memory test DB. Online mode
 * isn't covered separately — same code path, only the flag differs.
 * Lives under tests/integration/ because it needs the integration jest config
 * to resolve better-sqlite3.
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

// Stub supabase (imported transitively via PlantationRepository); only the import must not blow up.
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
import * as ParcelaRepo from '../../src/repositories/ParcelaRepository';
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
 * native transaction() throws "Transaction function cannot return a promise"); deletePlantationLocally
 * (called by the rollback path below) uses one. Real devices run drizzle-orm/expo-sqlite, which
 * doesn't have this restriction — this shim reproduces that behaviour for the real sqlite instance
 * used here, so the rollback tests exercise the actual delete logic instead of a mock.
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

beforeEach(async () => {
  await mockTestDb.delete(parcelas);
  // Antes que plantations: FK plantation_users → plantations sin CASCADE (#67).
  await mockTestDb.delete(plantationUsers);
  await mockTestDb.delete(plantations);
  jest.restoreAllMocks();
  installAsyncTransactionShim();
});

describe('createPlantationWithDefaultParcela', () => {
  test('flag ON + offline → crea plantación + parcela "Parcela 1"/"P1" con pendingSync=true', async () => {
    const r = await createPlantationWithDefaultParcela(baseParams);
    expect(r.id).toBeTruthy();
    const plantationRows = await mockTestDb.select().from(plantations).where(eq(plantations.id, r.id));
    expect(plantationRows).toHaveLength(1);
    const parcelaRows = await mockTestDb.select().from(parcelas).where(eq(parcelas.plantacionId, r.id));
    expect(parcelaRows).toHaveLength(1);
    expect(parcelaRows[0].nombre).toBe('Parcela 1');
    expect(parcelaRows[0].codigo).toBe('P1');
    expect(parcelaRows[0].descripcion).toBeNull();
    expect(parcelaRows[0].pendingSync).toBe(true);
  });

  test('flag ON + offline + createParcela retorna {success:false} → rollback (plantación NO existe)', async () => {
    jest.spyOn(ParcelaRepo, 'createParcela').mockResolvedValueOnce({
      success: false,
      error: 'codigo_duplicate',
    });
    await expect(createPlantationWithDefaultParcela(baseParams)).rejects.toThrow(/Default parcela/);
    const all = await mockTestDb.select().from(plantations);
    expect(all).toHaveLength(0);
    // El rollback también borra la membresía local del creador (#67).
    const membresias = await mockTestDb.select().from(plantationUsers);
    expect(membresias).toHaveLength(0);
  });

  test('crear plantación registra al creador como miembro admin local (#67)', async () => {
    const r = await createPlantationWithDefaultParcela(baseParams);
    const membresias = await mockTestDb.select().from(plantationUsers)
      .where(eq(plantationUsers.plantationId, r.id));
    expect(membresias).toHaveLength(1);
    expect(membresias[0]).toMatchObject({
      userId: 'user-admin-1',
      rolEnPlantacion: 'admin',
    });
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
});

describe('createPlantationWithDefaultParcela (online mode)', () => {
  const onlineParams = { ...baseParams, mode: 'online' as const };

  /** Arma supabase.from('plantations') para el insert de createPlantation + el delete de rollback. */
  function mockSupabaseForOnlineCreate(deleteError: unknown = null, deletedRows: Array<{ id: string }> = [{ id: 'srv-plantation-1' }]) {
    const insertedRow = {
      id: 'srv-plantation-1',
      organizacion_id: onlineParams.organizacionId,
      lugar: onlineParams.lugar,
      periodo: onlineParams.periodo,
      estado: 'activa',
      creado_por: onlineParams.creadoPor,
      created_at: new Date().toISOString(),
    };
    const deleteSelect = jest.fn().mockResolvedValue({ data: deleteError ? null : deletedRows, error: deleteError });
    const deleteEq = jest.fn().mockReturnValue({ select: deleteSelect });
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: insertedRow, error: null }),
        }),
      }),
      delete: jest.fn().mockReturnValue({ eq: deleteEq }),
    });
    return { deleteEq, insertedRow };
  }

  test('parcela falla → rollback local primero, luego borra la plantación remota, error se propaga', async () => {
    const { deleteEq } = mockSupabaseForOnlineCreate(null);
    jest.spyOn(ParcelaRepo, 'createParcela').mockResolvedValueOnce({
      success: false,
      error: 'codigo_duplicate',
    });

    await expect(createPlantationWithDefaultParcela(onlineParams)).rejects.toThrow(/Default parcela/);

    expect(deleteEq).toHaveBeenCalledWith('id', 'srv-plantation-1');
    const all = await mockTestDb.select().from(plantations);
    expect(all).toHaveLength(0);
    const membresias = await mockTestDb.select().from(plantationUsers);
    expect(membresias).toHaveLength(0);
  });

  test('parcela falla + delete remoto falla → igual hace cleanup local, error final avisa del leftover remoto', async () => {
    const remoteError = new Error('permission denied');
    mockSupabaseForOnlineCreate(remoteError);
    jest.spyOn(ParcelaRepo, 'createParcela').mockResolvedValueOnce({
      success: false,
      error: 'codigo_duplicate',
    });
    const errorSpy = jest.spyOn(syncLog, 'error').mockImplementation(() => {});

    await expect(createPlantationWithDefaultParcela(onlineParams)).rejects.toThrow(/además, no se pudo borrar la plantación remota/);

    const all = await mockTestDb.select().from(plantations);
    expect(all).toHaveLength(0);
    const membresias = await mockTestDb.select().from(plantationUsers);
    expect(membresias).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('srv-plantation-1'), remoteError);
  });

  test('parcela falla + delete remoto borra 0 filas (RLS) → tratado como leftover, error final avisa', async () => {
    mockSupabaseForOnlineCreate(null, []);
    jest.spyOn(ParcelaRepo, 'createParcela').mockResolvedValueOnce({
      success: false,
      error: 'codigo_duplicate',
    });
    const errorSpy = jest.spyOn(syncLog, 'error').mockImplementation(() => {});

    await expect(createPlantationWithDefaultParcela(onlineParams)).rejects.toThrow(/además, no se pudo borrar la plantación remota/);

    const all = await mockTestDb.select().from(plantations);
    expect(all).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('srv-plantation-1'), expect.any(Error));
  });

  test('rollback local falla → se propaga tal cual, remoto ni se intenta', async () => {
    const { deleteEq } = mockSupabaseForOnlineCreate(null);
    jest.spyOn(ParcelaRepo, 'createParcela').mockResolvedValueOnce({
      success: false,
      error: 'codigo_duplicate',
    });
    const localError = new Error('SQLITE_BUSY');
    const deleteSpy = jest.spyOn(mockTestDb, 'transaction').mockRejectedValueOnce(localError as never);

    await expect(createPlantationWithDefaultParcela(onlineParams)).rejects.toThrow('SQLITE_BUSY');

    expect(deleteEq).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  test('offline sigue sin llamar a supabase', async () => {
    const fromSpy = supabase.from as jest.Mock;
    fromSpy.mockClear();
    jest.spyOn(ParcelaRepo, 'createParcela').mockResolvedValueOnce({
      success: false,
      error: 'codigo_duplicate',
    });

    await expect(createPlantationWithDefaultParcela(baseParams)).rejects.toThrow(/Default parcela/);

    expect(fromSpy).not.toHaveBeenCalled();
  });
});

describe('createPlantationWithDefaultParcela (flag OFF)', () => {
  test('flag OFF + offline → solo crea plantación, 0 parcelas', async () => {
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
});
