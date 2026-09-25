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
    auth: { getSession: jest.fn(), getUser: jest.fn(), refreshSession: jest.fn() },
    rpc: jest.fn(),
  },
  isSupabaseConfigured: true,
}));

// Mock GroupRepository (required by SyncService module)
jest.mock('../../src/repositories/GroupRepository', () => ({
  markAsSincronizada: jest.fn(),
  getSyncableGroups: jest.fn(),
}));

jest.mock('../../src/repositories/PlantationRepository', () => ({
  deletePlantationLocally: jest.fn().mockResolvedValue(undefined),
}));

// Passthrough que marca si hay una transacción abierta: así se puede afirmar que
// las escrituras del pull caen adentro y no después del commit (#448).
let mockDentroDeTransaccion = false;
jest.mock('../../src/database/transaccion', () => ({
  FILAS_POR_TRANSACCION: jest.requireActual('../../src/database/transaccion').FILAS_POR_TRANSACCION,
  enTransaccion: jest.fn(),
  enTransaccionPorLotes: jest.fn(),
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
import { deletePlantationLocally } from '../../src/repositories/PlantationRepository';
import { cancelarCorrida, iniciarCorrida, SyncCanceladoError, terminarCorrida } from '../../src/services/sync/cancelacion';
import { enTransaccion, enTransaccionPorLotes } from '../../src/database/transaccion';
import { conSesionDelServidor, conUsuarioCacheado } from '../helpers/rolCacheado';

/**
 * `jest.resetAllMocks()` borra la implementación de los mocks de módulo, así que el
 * passthrough se vuelve a poner en cada `beforeEach`.
 */
function setupTransaccionPassthrough() {
  const abrir = async (cb: (tx: unknown) => Promise<unknown>) => {
    mockDentroDeTransaccion = true;
    try {
      return await cb(db);
    } finally {
      mockDentroDeTransaccion = false;
    }
  };
  (enTransaccion as jest.Mock).mockImplementation(abrir);
  (enTransaccionPorLotes as jest.Mock).mockImplementation(
    async (
      filas: unknown[],
      escribirLote: (tx: unknown, lote: unknown[]) => Promise<void>,
      onLote?: (n: number) => void,
    ) => {
      await abrir((tx) => escribirLote(tx, filas));
      onLote?.(filas.length);
    },
  );
}

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
 * El pull chequea el acceso antes de tocar la base (#317). Estos tests simulan un
 * server sin `estado_remoto_plantaciones` (#478), así el chequeo cae a la membresía.
 */
function setupSesion() {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  conUsuarioCacheado('user-1');
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
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

/** Como `setupSupabaseFromEmpty`, pero el server trae `filas` para una tabla. */
function setupSupabaseConFilas(tabla: string, filas: any[]) {
  const encadenable = (t: string, columnas: string[]): any => {
    const esMembresia = t === 'plantation_users' && columnas.includes('user_id');
    const data = esMembresia ? [{ user_id: 'user-1' }] : t === tabla ? filas : [];
    const resultado = Promise.resolve({ data, error: null }) as any;
    resultado.eq = jest.fn((col: string) => encadenable(t, [...columnas, col]));
    resultado.in = jest.fn((col: string) => encadenable(t, [...columnas, col]));
    resultado.range = jest.fn(() => Promise.resolve({ data, error: null }));
    resultado.single = jest.fn().mockResolvedValue({ data: null, error: null });
    return resultado;
  };
  (supabase.from as jest.Mock).mockImplementation((t: string) => ({
    select: jest.fn(() => encadenable(t, [])),
  }));
}

/** Membresía vacía: `tieneAccesoRemoto` da false y el pull devuelve "sin acceso". */
function setupSinMembresia() {
  const encadenable = (): any => {
    const resultado = Promise.resolve({ data: [], error: null }) as any;
    resultado.eq = jest.fn(() => encadenable());
    resultado.in = jest.fn(() => encadenable());
    resultado.single = jest.fn().mockResolvedValue({ data: null, error: null });
    return resultado;
  };
  (supabase.from as jest.Mock).mockImplementation(() => ({ select: jest.fn(() => encadenable()) }));
}

/** Lo que devuelve el `select` de "¿la plantación ya estaba local?". */
function setupPlantacionLocal(filas: { id: string }[]) {
  (db.select as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(filas),
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
    setupSesion();
    setupSupabaseFromEmpty();
    setupDbSelectEmpty();
    setupTransaccionPassthrough();
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

  it('propaga el error si el upsert local falla', async () => {
    const sp = makeServerPlantation('p-3');
    setupDbInsertFailure();

    await expect(downloadPlantation(sp)).rejects.toThrow('DB write error');
  });

  it('mapea visible_in_app del server; en conflicto no pisa valor vivo ni snapshot (los pone el pull)', async () => {
    const sp = { ...makeServerPlantation('p-oculta'), visible_in_app: false };
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ visibleInApp: false, visibleInAppServer: false }));
    const set = onConflictSpy.mock.calls[0][0].set;
    expect(set).not.toHaveProperty('visibleInApp');
    expect(set).not.toHaveProperty('visibleInAppServer');
  });

  it('sin la columna en el server no manda el campo: queda el default del schema', async () => {
    const sp = makeServerPlantation('p-sin-columna'); // sin visible_in_app ni photo_capture_all_trees
    const { valuesSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    const values = valuesSpy.mock.calls[0][0];
    expect(values).not.toHaveProperty('visibleInApp');
    expect(values).not.toHaveProperty('photoCaptureAllTrees');
  });

  it('mapea photo_capture_all_trees y los datos de #633 del server', async () => {
    const sp = {
      ...makeServerPlantation('p-foto'),
      photo_capture_all_trees: true,
      descripcion: 'Ribera',
      fecha_inicio: '2026-04-15',
      objetivo_arboles: 12000,
    };
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      photoCaptureAllTrees: true,
      descripcion: 'Ribera',
      fechaInicio: '2026-04-15',
      objetivoArboles: 12000,
      objetivoArbolesServer: 12000,
    }));
    expect(onConflictSpy.mock.calls[0][0].set).not.toHaveProperty('descripcionServer');
  });

  it('mapea archivada_en del server al campo local archivadaEn (#477)', async () => {
    const sp = { ...makeServerPlantation('p-archivada'), archivada_en: '2026-09-17T12:00:00+00:00' };
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ archivadaEn: '2026-09-17T12:00:00+00:00' }));
    expect(onConflictSpy.mock.calls[0][0].set).toMatchObject({ archivadaEn: '2026-09-17T12:00:00+00:00' });
  });

  // El upsert tiene que escribir el null: si no, desarchivar en la web no llega al device.
  it('archivadaEn=null explícito cuando el server no trae la columna o no está archivada', async () => {
    const sp = makeServerPlantation('p-sin-archivar');
    const { valuesSpy, onConflictSpy } = setupDbInsertSuccess();

    await downloadPlantation(sp);

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ archivadaEn: null }));
    expect(onConflictSpy.mock.calls[0][0].set).toMatchObject({ archivadaEn: null });
  });
});

describe('pull · las escrituras van adentro de la transacción (#448)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupSesion();
    setupDbInsertSuccess();
    setupDbSelectEmpty();
    setupTransaccionPassthrough();
    mockDentroDeTransaccion = false;
  });

  // Sin esto, el pull escribía fila por fila en autocommit y ningún test lo veía.
  it('la fase de parcelas upsertea con una transacción abierta', async () => {
    setupSupabaseConFilas('parcelas', [
      { id: 'par-1', plantation_id: 'p-1', nombre: 'Norte', codigo: 'N', created_at: '', updated_at: '' },
    ]);
    const dentro: boolean[] = [];
    (db.insert as jest.Mock).mockImplementation(() => {
      dentro.push(mockDentroDeTransaccion);
      return { values: jest.fn(() => ({ onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) })) };
    });

    await downloadPlantation(makeServerPlantation('p-1'));

    // El primer insert es el upsert de la plantación, fuera de transacción a
    // propósito; el de la parcela es el que tiene que caer adentro.
    expect(dentro).toEqual([false, true]);
  });
});

describe('downloadPlantation · pull fallido (#448)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupSesion();
    setupDbInsertSuccess();
    setupSinMembresia();
    setupTransaccionPassthrough();
    (deletePlantationLocally as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => terminarCorrida());

  // La fila se inserta con `pendingSync: false` ANTES del pull: si el pull falla
  // queda una plantación "descargada" y vacía en el listado.
  it('revierte la plantación nueva cuyo pull falló', async () => {
    setupPlantacionLocal([]);

    await expect(downloadPlantation(makeServerPlantation('p-nueva'))).rejects.toThrow('Sin acceso');

    expect(deletePlantationLocally).toHaveBeenCalledWith('p-nueva');
  });

  /**
   * La cancelación es de módulo: cortar una sync alcanza a cualquier descarga de
   * catálogo que estuviera corriendo en paralelo. Eso se aborta y se reintenta —
   * pero no puede disparar el borrado, que es destructivo (#451).
   */
  it('una cancelación aborta la descarga pero NO borra la plantación', async () => {
    setupPlantacionLocal([]);
    iniciarCorrida();
    cancelarCorrida();

    await expect(downloadPlantation(makeServerPlantation('p-nueva'))).rejects.toBeInstanceOf(SyncCanceladoError);

    expect(deletePlantationLocally).not.toHaveBeenCalled();
  });

  // Una que ya estaba descargada conserva sus datos viejos: son mejores que nada
  // y el pull es idempotente, así que el próximo intento converge.
  it('no toca una plantación que ya estaba local', async () => {
    setupPlantacionLocal([{ id: 'p-vieja' }]);

    await expect(downloadPlantation(makeServerPlantation('p-vieja'))).rejects.toThrow('Sin acceso');

    expect(deletePlantationLocally).not.toHaveBeenCalled();
  });
});

describe('batchDownload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupSesion();
    setupSupabaseFromEmpty();
    setupDbSelectEmpty();
    setupTransaccionPassthrough();
  });

  it('sin sesión del servidor lanza SessionExpiredError sin leer ni escribir nada (#658)', async () => {
    setupDbInsertSuccess();
    conSesionDelServidor(supabase.auth, null);

    await expect(batchDownload([makeServerPlantation('p-1', 'Bosque Norte')]))
      .rejects.toMatchObject({ name: 'SessionExpiredError' });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(notifyDataChanged).not.toHaveBeenCalled();
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
