// Tests for downloadPlantation and batchDownload (download side) in SyncService.

jest.mock('../../src/database/client', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

// Mock GroupRepository (required by SyncService module)
jest.mock('../../src/repositories/GroupRepository', () => ({
  markAsSincronizada: jest.fn(),
  getSyncableGroups: jest.fn(),
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

/** El pull chequea la membresía propia antes de tocar la base (#317). */
function setupSesion() {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
}

/**
 * Sets up supabase.from to return empty data (simulates empty pullFromServer).
 * eq() es encadenable y a la vez awaitable, y expone .single(), cubriendo los
 * patrones que usa pullFromServer: .eq().single(), .eq(), .eq().eq(), .in().
 *
 * Ojo: con data vacío el chequeo de membresía de #317 devolvería "sin acceso",
 * así que la fila de membresía se sirve aparte.
 */
function setupSupabaseFromEmpty() {
  // El chequeo de membresía filtra por user_id; el replace de plantation_users
  // del pull filtra solo por plantation_id y sigue viendo el server vacío.
  const esChequeoDeMembresia = (tabla: string, columnas: string[]) =>
    tabla === 'plantation_users' && columnas.includes('user_id');

  const encadenable = (tabla: string, columnas: string[]): any => {
    const resultado = Promise.resolve({
      data: esChequeoDeMembresia(tabla, columnas) ? [{ user_id: 'user-1' }] : [],
      error: null,
    }) as any;
    resultado.eq = jest.fn((col: string) => encadenable(tabla, [...columnas, col]));
    resultado.in = jest.fn((col: string) => encadenable(tabla, [...columnas, col]));
    resultado.single = jest.fn().mockResolvedValue({ data: null, error: null });
    return resultado;
  };
  (supabase.from as jest.Mock).mockImplementation((tabla: string) => ({
    select: jest.fn(() => encadenable(tabla, [])),
  }));
}

/**
 * Sets up db.select/update/delete chains used by pullFromServer: select for the
 * pendingEdit check and plantation_users, update for plantation metadata, delete
 * for removed plantation_users.
 */
function setupDbSelectEmpty() {
  (db.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([]),
    }),
  });
  (db.update as jest.Mock).mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  });
  (db.delete as jest.Mock).mockReturnValue({
    where: jest.fn().mockResolvedValue(undefined),
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
    setupSesion();
    setupSupabaseFromEmpty();
    setupDbSelectEmpty();
  });

  it('Test 1: upserts plantation row into local SQLite then calls pullFromServer', async () => {
    const sp = makeServerPlantation('p-1');
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(db.insert).toHaveBeenCalled();
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p-1',
      organizacionId: 'org-1',
      lugar: 'Bosque Norte',
      periodo: '2026',
      estado: 'activa',
      creadoPor: 'user-admin',
      createdAt: '2026-01-01T00:00:00Z',
    }));
    expect(onConflictSpy).toHaveBeenCalled();
    // pullFromServer runs too (it calls supabase.from).
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
    // target must be the plantations.id column reference
    expect(conflictArgs).toHaveProperty('target');
    expect(conflictArgs).toHaveProperty('set');
    expect(conflictArgs.set).toHaveProperty('estado');
  });

  it('mapea visible_in_app del server al campo local visibleInApp', async () => {
    const sp = { ...makeServerPlantation('p-oculta'), visible_in_app: false };
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ visibleInApp: false }));
    expect(onConflictSpy.mock.calls[0][0].set).toMatchObject({ visibleInApp: false });
  });

  it('defaultea visibleInApp=true cuando el server no trae la columna (migración sin aplicar)', async () => {
    const sp = makeServerPlantation('p-sin-columna'); // sin visible_in_app
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ visibleInApp: true }));
    expect(onConflictSpy.mock.calls[0][0].set).toMatchObject({ visibleInApp: true });
  });

  it('mapea photo_capture_all_trees del server al campo local photoCaptureAllTrees (#439)', async () => {
    const sp = { ...makeServerPlantation('p-foto'), photo_capture_all_trees: true };
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ photoCaptureAllTrees: true }));
    expect(onConflictSpy.mock.calls[0][0].set).toMatchObject({ photoCaptureAllTrees: true });
  });

  it('defaultea photoCaptureAllTrees=false cuando el server no trae la columna (035 sin aplicar)', async () => {
    const sp = makeServerPlantation('p-sin-foto-flag');
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ photoCaptureAllTrees: false }));
    expect(onConflictSpy.mock.calls[0][0].set).toMatchObject({ photoCaptureAllTrees: false });
  });
});

describe('batchDownload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupSesion();
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

  it('Test 4: emits onProgress with plantation index and name as the batch advances', async () => {
    setupDbInsertSuccess();

    const plantations = [
      makeServerPlantation('p-1', 'Bosque Norte'),
      makeServerPlantation('p-2', 'Sector Sur'),
    ];
    const progressCalls: DownloadProgress[] = [];
    const onProgress = (p: DownloadProgress) => progressCalls.push({ ...p });

    await batchDownload(plantations, onProgress);

    // Multiple events fire per plantation (per-phase progress + start) — reduce to
    // the first per plantation to check order and name/index.
    const firstEventPerPlantation = progressCalls.filter(
      (p, i, arr) => i === 0 || p.currentName !== arr[i - 1].currentName,
    );
    expect(firstEventPerPlantation).toHaveLength(2);
    expect(firstEventPerPlantation[0]).toMatchObject({
      plantationIndex: 1,
      plantationTotal: 2,
      currentName: 'Bosque Norte',
    });
    expect(firstEventPerPlantation[1]).toMatchObject({
      plantationIndex: 2,
      plantationTotal: 2,
      currentName: 'Sector Sur',
    });
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
    expect(typeof results[0].nombre).toBe('string');
    expect(typeof results[0].success).toBe('boolean');
    expect(typeof results[0].id).toBe('string');
  });
});
