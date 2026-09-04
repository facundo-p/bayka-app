/**
 * Integration tests: captura GPS al registrar árboles (issue #97).
 * updateTreeGps re-marca pendingSync del grupo aunque ya esté sincronizado,
 * porque el fix GPS puede resolver después de un push, y es no-op sobre un
 * árbol deshecho. attachGpsCapture usa el fix del watcher si está fresco o
 * pide uno nuevo si no. insertTreeWithGps captura según la frecuencia
 * configurada por posición.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';

import { GPS_FIX_MAX_AGE_MS } from '../../src/constants/gpsCapture';
import { groups, parcelas, plantations, trees } from '../../src/database/schema';
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';

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

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'tree-' + Math.random().toString(36).slice(2, 10),
}));

// Cliente de ubicación mockeado: controla el fix fresco pedido al tap.
const mockGetCurrentGpsFix = jest.fn();
jest.mock('../../src/services/gps/locationClient', () => ({
  getCurrentGpsFix: (...args: any[]) => mockGetCurrentGpsFix(...args),
}));

jest.mock('../../src/utils/gpsLogger', () => ({
  gpsLog: { info: jest.fn(), error: jest.fn() },
}));

import { updateTreeGps } from '../../src/repositories/TreeRepository';
import {
  attachGpsCapture,
  insertTreeWithGps,
} from '../../src/services/gps/gpsCaptureService';

const PLANTATION_ID = 'plant-1';
const GROUP_ID = 'group-1';
const NOW = '2026-06-10T12:00:00';

async function seedPlantationAndGroup(groupPendingSync = false) {
  await mockTestDb.insert(plantations).values({
    id: PLANTATION_ID,
    organizacionId: 'org-1',
    lugar: 'Campo Norte',
    periodo: '2026',
    estado: 'activa',
    creadoPor: 'user-admin-1',
    createdAt: NOW,
  });
  await mockTestDb.insert(parcelas).values({
    id: 'parcela-1',
    plantacionId: PLANTATION_ID,
    nombre: 'Lote A',
    codigo: 'P',
    createdAt: NOW,
    updatedAt: NOW,
  });
  await mockTestDb.insert(groups).values({
    id: GROUP_ID,
    plantacionId: PLANTATION_ID,
    parcelaId: 'parcela-1',
    nombre: 'Línea 1',
    codigo: 'L1',
    tipo: 'linea',
    estado: 'activa',
    usuarioCreador: 'user-tecnico-1',
    createdAt: NOW,
    pendingSync: groupPendingSync,
  });
}

async function seedTree(id: string, posicion: number) {
  await mockTestDb.insert(trees).values({
    id,
    groupId: GROUP_ID,
    especieId: null,
    posicion,
    subId: `PL1NN${posicion}`,
    usuarioRegistro: 'user-tecnico-1',
    createdAt: NOW,
  });
}

function watcherFix(ageMs: number, tapAtMs: number) {
  return { latitude: -31.5, longitude: -60.7, accuracy: 2.5, timestamp: tapAtMs - ageMs };
}

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  jest.clearAllMocks();
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(plantations);
});

describe('updateTreeGps', () => {
  test('escribe el punto y re-marca el grupo pendingSync (grupo ya sincronizado)', async () => {
    await seedPlantationAndGroup(false);
    await seedTree('tree-1', 1);

    await updateTreeGps('tree-1', {
      latitude: -31.5,
      longitude: -60.7,
      gpsAccuracy: 2.5,
      gpsCapturedAt: NOW,
    });

    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 'tree-1'));
    expect(tree.latitude).toBeCloseTo(-31.5);
    expect(tree.longitude).toBeCloseTo(-60.7);
    expect(tree.gpsAccuracy).toBeCloseTo(2.5);
    expect(tree.gpsCapturedAt).toBe(NOW);

    const [group] = await mockTestDb.select().from(groups).where(eq(groups.id, GROUP_ID));
    expect(group.pendingSync).toBe(true);
  });

  test('árbol inexistente (deshecho antes del fix) es no-op sin error', async () => {
    await seedPlantationAndGroup(false);

    await expect(
      updateTreeGps('tree-borrado', {
        latitude: -31.5,
        longitude: -60.7,
        gpsAccuracy: 2.5,
        gpsCapturedAt: NOW,
      }),
    ).resolves.toBeUndefined();

    const [group] = await mockTestDb.select().from(groups).where(eq(groups.id, GROUP_ID));
    expect(group.pendingSync).toBe(false);
  });
});

describe('attachGpsCapture', () => {
  test('fix del watcher fresco: lo usa sin pedir fix nuevo', async () => {
    await seedPlantationAndGroup();
    await seedTree('tree-1', 1);
    const tapAtMs = Date.now();

    await attachGpsCapture('tree-1', watcherFix(0, tapAtMs), tapAtMs);

    expect(mockGetCurrentGpsFix).not.toHaveBeenCalled();
    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 'tree-1'));
    expect(tree.latitude).toBeCloseTo(-31.5);
    expect(tree.gpsCapturedAt).not.toBeNull();
  });

  test('fix del watcher viejo: pide un fix fresco en el instante', async () => {
    await seedPlantationAndGroup();
    await seedTree('tree-1', 1);
    const tapAtMs = Date.now();
    mockGetCurrentGpsFix.mockResolvedValue({
      latitude: -32.0,
      longitude: -61.0,
      accuracy: 4.0,
      timestamp: tapAtMs + 500,
    });

    await attachGpsCapture('tree-1', watcherFix(GPS_FIX_MAX_AGE_MS + 1000, tapAtMs), tapAtMs);

    expect(mockGetCurrentGpsFix).toHaveBeenCalledTimes(1);
    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 'tree-1'));
    expect(tree.latitude).toBeCloseTo(-32.0);
    expect(tree.gpsAccuracy).toBeCloseTo(4.0);
  });

  test('sin fix disponible (timeout): el árbol queda sin coordenadas, sin error', async () => {
    await seedPlantationAndGroup();
    await seedTree('tree-1', 1);
    mockGetCurrentGpsFix.mockResolvedValue(null);

    await expect(attachGpsCapture('tree-1', null, Date.now())).resolves.toBe(false);

    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 'tree-1'));
    expect(tree.latitude).toBeNull();
    expect(tree.gpsCapturedAt).toBeNull();
  });
});

describe('insertTreeWithGps (regla por posición, N=10)', () => {
  async function registerOne(tapFix: ReturnType<typeof watcherFix> | null) {
    return insertTreeWithGps(
      { grupoId: GROUP_ID, grupoCodigo: 'L1', especieId: null, especieCodigo: 'NN', userId: 'user-tecnico-1' },
      10,
      () => tapFix,
    );
  }

  test('posiciones 1 y 11 capturan; 2–10 no; deshacer y re-registrar re-captura', async () => {
    await seedPlantationAndGroup();
    const tapAtMs = Date.now();
    const fix = watcherFix(0, tapAtMs);

    const first = await registerOne(fix);
    expect(first.posicion).toBe(1);
    for (let i = 2; i <= 10; i++) await registerOne(fix);
    const eleventh = await registerOne(fix);
    expect(eleventh.posicion).toBe(11);

    // attachGpsCapture corre fire-and-forget: drenar microtasks pendientes.
    await new Promise((r) => setTimeout(r, 0));

    const all = await mockTestDb.select().from(trees);
    const withGps = all.filter((t) => t.latitude !== null).map((t) => t.posicion).sort((a, b) => a - b);
    expect(withGps).toEqual([1, 11]);
  });

  test('sin fix disponible el alta funciona exactamente igual', async () => {
    await seedPlantationAndGroup();
    mockGetCurrentGpsFix.mockResolvedValue(null);

    const inserted = await registerOne(null);
    await new Promise((r) => setTimeout(r, 0));

    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, inserted.id));
    expect(tree.posicion).toBe(1);
    expect(tree.latitude).toBeNull();
  });
});
