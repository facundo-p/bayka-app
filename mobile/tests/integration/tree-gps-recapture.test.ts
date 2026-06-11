/**
 * Integration tests: re-captura manual del punto GPS del último árbol (#103).
 * SQLite real. Verifica reemplazo del punto, re-marca de pendingSync en grupo
 * ya sincronizado, y que un fallo de fix conserva el punto anterior.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';

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

const mockGetCurrentGpsFix = jest.fn();
jest.mock('../../src/services/gps/locationClient', () => ({
  getCurrentGpsFix: (...args: any[]) => mockGetCurrentGpsFix(...args),
}));

jest.mock('../../src/utils/gpsLogger', () => ({
  gpsLog: { info: jest.fn(), error: jest.fn() },
}));

import { recaptureTreeGps } from '../../src/services/gps/gpsCaptureService';

const NOW = '2026-06-10T12:00:00';

async function seedAll(groupPendingSync: boolean) {
  await mockTestDb.insert(plantations).values({
    id: 'plant-1', organizacionId: 'org-1', lugar: 'Campo', periodo: '2026',
    estado: 'activa', creadoPor: 'u-1', createdAt: NOW,
  });
  await mockTestDb.insert(parcelas).values({
    id: 'parc-1', plantacionId: 'plant-1', nombre: 'Lote A', codigo: 'P',
    createdAt: NOW, updatedAt: NOW,
  });
  await mockTestDb.insert(groups).values({
    id: 'g-1', plantacionId: 'plant-1', parcelaId: 'parc-1', nombre: 'L1',
    codigo: 'L1', tipo: 'linea', estado: 'activa', usuarioCreador: 'u-1',
    createdAt: NOW, pendingSync: groupPendingSync,
  });
  await mockTestDb.insert(trees).values({
    id: 't-1', groupId: 'g-1', especieId: null, posicion: 1, subId: 'PL1NN1',
    usuarioRegistro: 'u-1', createdAt: NOW,
    latitude: -31.0, longitude: -60.0, gpsAccuracy: 15.0, gpsCapturedAt: NOW,
  });
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

describe('recaptureTreeGps', () => {
  test('reemplaza el punto (precisión mala → buena) y re-marca el grupo sincronizado', async () => {
    await seedAll(false); // grupo ya sincronizado: el UPDATE debe re-marcarlo
    mockGetCurrentGpsFix.mockResolvedValue({
      latitude: -31.5, longitude: -60.5, accuracy: 2.0, timestamp: Date.now(),
    });

    const captured = await recaptureTreeGps('t-1');

    expect(captured).toBe(true);
    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
    expect(tree.latitude).toBeCloseTo(-31.5);
    expect(tree.gpsAccuracy).toBeCloseTo(2.0);
    const [group] = await mockTestDb.select().from(groups).where(eq(groups.id, 'g-1'));
    expect(group.pendingSync).toBe(true);
  });

  test('usa el fix fresco del watcher sin pedir uno nuevo', async () => {
    await seedAll(false);
    const freshFix = { latitude: -32.0, longitude: -61.0, accuracy: 1.5, timestamp: Date.now() };

    const captured = await recaptureTreeGps('t-1', () => freshFix);

    expect(captured).toBe(true);
    expect(mockGetCurrentGpsFix).not.toHaveBeenCalled();
    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
    expect(tree.latitude).toBeCloseTo(-32.0);
  });

  test('sin fix disponible: devuelve false y el punto anterior se conserva intacto', async () => {
    await seedAll(false);
    mockGetCurrentGpsFix.mockResolvedValue(null);

    const captured = await recaptureTreeGps('t-1');

    expect(captured).toBe(false);
    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
    expect(tree.latitude).toBeCloseTo(-31.0);
    expect(tree.gpsAccuracy).toBeCloseTo(15.0);
    expect(tree.gpsCapturedAt).toBe(NOW);
    const [group] = await mockTestDb.select().from(groups).where(eq(groups.id, 'g-1'));
    expect(group.pendingSync).toBe(false);
  });

  test('árbol deshecho antes de resolver: no-op sin error', async () => {
    await seedAll(false);
    mockGetCurrentGpsFix.mockResolvedValue({
      latitude: -31.5, longitude: -60.5, accuracy: 2.0, timestamp: Date.now(),
    });

    await expect(recaptureTreeGps('t-inexistente')).resolves.toBe(true);
    // El árbol con punto previo no fue tocado.
    const [tree] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
    expect(tree.latitude).toBeCloseTo(-31.0);
  });
});
