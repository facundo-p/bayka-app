// Tests for downloadPlantation and batchDownload in SyncService
// Covers: CATL-01, CATL-04, CATL-06 (download side)

jest.mock('../../src/database/client', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn(), getUser: jest.fn() },
    rpc: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

// Mock SubGroupRepository (required by SyncService module)
jest.mock('../../src/repositories/SubGroupRepository', () => ({
  markAsSincronizada: jest.fn(),
  getSyncableSubGroups: jest.fn(),
}));

const { db } = require('../../src/database/client');
const { notifyDataChanged } = require('../../src/database/liveQuery');
const { supabase } = require('../../src/supabase/client');

import {
  downloadPlantation,
  batchDownload,
  DownloadResult,
  DownloadProgress,
} from '../../src/services/SyncService';

// Helper to build a server plantation object
const makeServerPlantation = (id: string, lugar = 'Bosque Norte') => ({
  id,
  organizacion_id: 'org-1',
  lugar,
  periodo: '2026',
  estado: 'activa',
  creado_por: 'user-admin',
  created_at: '2026-01-01T00:00:00Z',
});

/**
 * Sets up db.insert mock to succeed (onConflictDoUpdate resolves).
 * Returns spies for verification.
 */
function setupDbInsertSuccess() {
  const onConflictSpy = jest.fn().mockResolvedValue(undefined);
  const valuesSpy = jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictSpy });
  (db.insert as jest.Mock).mockReturnValue({ values: valuesSpy });
  return { valuesSpy, onConflictSpy };
}

/**
 * Sets up supabase.from to return empty data (simulates empty pullFromServer).
 */
function setupSupabaseFromEmpty() {
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });
}

/**
 * Sets up db.select to return a chain used by pullFromServer.
 * pullFromServer calls db.select().from().where() for plantation_users.
 */
function setupDbSelectEmpty() {
  (db.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([]),
    }),
  });
}

/**
 * Sets up db.insert to throw an error (simulates upsert failure).
 */
function setupDbInsertFailure() {
  (db.insert as jest.Mock).mockReturnValue({
    values: jest.fn().mockReturnValue({
      onConflictDoUpdate: jest.fn().mockRejectedValue(new Error('DB write error')),
    }),
  });
}

describe('downloadPlantation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupSupabaseFromEmpty();
    setupDbSelectEmpty();
  });

  it('Test 1: upserts plantation row into local SQLite then calls pullFromServer', async () => {
    const sp = makeServerPlantation('p-1');
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    // Verify db.insert was called (upsert step)
    expect(db.insert).toHaveBeenCalled();
    // Verify values was called with correct camelCase field mapping
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p-1',
      organizacionId: 'org-1',
      lugar: 'Bosque Norte',
      periodo: '2026',
      estado: 'activa',
      creadoPor: 'user-admin',
      createdAt: '2026-01-01T00:00:00Z',
    }));
    // Verify onConflictDoUpdate was called (upsert pattern)
    expect(onConflictSpy).toHaveBeenCalled();
    // Verify pullFromServer was called (supabase.from is called by pullFromServer)
    expect(supabase.from).toHaveBeenCalled();
  });

  it('Test 2: uses onConflictDoUpdate with target plantations.id and set estado', async () => {
    const sp = makeServerPlantation('p-2');
    const onConflictSpy = jest.fn().mockResolvedValue(undefined);
    const valuesSpy = jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictSpy });
    (db.insert as jest.Mock).mockReturnValue({ values: valuesSpy });

    await downloadPlantation(sp);

    expect(onConflictSpy).toHaveBeenCalledTimes(1);
    const conflictArgs = onConflictSpy.mock.calls[0][0];
    // Verify the target is provided (plantations.id column reference)
    expect(conflictArgs).toHaveProperty('target');
    // Verify set has estado
    expect(conflictArgs).toHaveProperty('set');
    expect(conflictArgs.set).toHaveProperty('estado');
  });
});

describe('batchDownload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupSupabaseFromEmpty();
    setupDbSelectEmpty();
  });

  it('Test 3: calls downloadPlantation (db.insert) for each selected plantation in order', async () => {
    setupDbInsertSuccess();

    const plantations = [
      makeServerPlantation('p-1', 'Bosque Norte'),
      makeServerPlantation('p-2', 'Sector Sur'),
      makeServerPlantation('p-3', 'Parcela Este'),
    ];

    await batchDownload(plantations);

    // db.insert is called once per plantation (via downloadPlantation)
    expect(db.insert).toHaveBeenCalledTimes(3);
  });

  it('Test 4: calls onProgress with { total, completed, currentName } before each download', async () => {
    setupDbInsertSuccess();

    const plantations = [
      makeServerPlantation('p-1', 'Bosque Norte'),
      makeServerPlantation('p-2', 'Sector Sur'),
    ];
    const progressCalls: DownloadProgress[] = [];
    const onProgress = (p: DownloadProgress) => progressCalls.push({ ...p });

    await batchDownload(plantations, onProgress);

    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0]).toEqual({ total: 2, completed: 0, currentName: 'Bosque Norte' });
    expect(progressCalls[1]).toEqual({ total: 2, completed: 1, currentName: 'Sector Sur' });
  });

  it('Test 5: continues on per-plantation error and includes failure in results', async () => {
    // p-1 succeeds, p-2 fails (db error), p-3 succeeds
    const onConflictResolve = jest.fn().mockResolvedValue(undefined);
    const onConflictReject = jest.fn().mockRejectedValue(new Error('Network timeout'));

    (db.insert as jest.Mock)
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictResolve }) })
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictReject }) })
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictResolve }) });

    const plantations = [
      makeServerPlantation('p-1', 'Bosque Norte'),
      makeServerPlantation('p-2', 'Sector Fallido'),
      makeServerPlantation('p-3', 'Parcela Este'),
    ];

    const results = await batchDownload(plantations);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ success: true, id: 'p-1', nombre: 'Bosque Norte' });
    expect(results[1]).toEqual({ success: false, id: 'p-2', nombre: 'Sector Fallido' });
    expect(results[2]).toEqual({ success: true, id: 'p-3', nombre: 'Parcela Este' });
  });

  it('Test 6: calls notifyDataChanged exactly once after the loop (not per iteration)', async () => {
    setupDbInsertSuccess();

    const plantations = [
      makeServerPlantation('p-1'),
      makeServerPlantation('p-2'),
      makeServerPlantation('p-3'),
    ];

    await batchDownload(plantations);

    // notifyDataChanged must be called exactly once (after the entire loop)
    expect(notifyDataChanged).toHaveBeenCalledTimes(1);
  });

  it('Test 7: returns DownloadResult[] with success/failure per plantation', async () => {
    const onConflictResolve = jest.fn().mockResolvedValue(undefined);
    const onConflictReject = jest.fn().mockRejectedValue(new Error('Error'));

    (db.insert as jest.Mock)
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictResolve }) })
      .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ onConflictDoUpdate: onConflictReject }) });

    const plantations = [
      makeServerPlantation('p-1', 'Alpha'),
      makeServerPlantation('p-2', 'Beta'),
    ];

    const results: DownloadResult[] = await batchDownload(plantations);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ success: true, id: 'p-1', nombre: 'Alpha' });
    expect(results[1]).toMatchObject({ success: false, id: 'p-2', nombre: 'Beta' });
    // Verify shape of returned type
    expect(typeof results[0].nombre).toBe('string');
    expect(typeof results[0].success).toBe('boolean');
    expect(typeof results[0].id).toBe('string');
  });
});
