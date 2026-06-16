/**
 * Integration test: getTreesForGroup expone los campos GPS (issue #99).
 * SQLite real con migraciones completas.
 */
import Database from 'better-sqlite3';

import { groups, parcelas, plantations, species, trees } from '../../src/database/schema';
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { getTreesForGroup, getTreeDetail } from '../../src/queries/treeQueries';

const NOW = '2026-06-10T12:00:00';

beforeAll(async () => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;

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
    codigo: 'L1', tipo: 'linea', estado: 'activa', usuarioCreador: 'u-1', createdAt: NOW,
  });
  await mockTestDb.insert(species).values({
    id: 'esp-1', codigo: 'EUC', nombre: 'Eucalipto', createdAt: NOW,
  });
});

afterAll(() => {
  closeTestDb(sqlite);
});

test('expone latitude/longitude/gpsAccuracy y especie resuelta, orden desc', async () => {
  await mockTestDb.insert(trees).values({
    id: 't-1', groupId: 'g-1', especieId: 'esp-1', posicion: 1, subId: 'PL1EUC1',
    usuarioRegistro: 'u-1', createdAt: NOW,
    latitude: -31.5, longitude: -60.7, gpsAccuracy: 2.5, gpsCapturedAt: NOW,
  });
  await mockTestDb.insert(trees).values({
    id: 't-2', groupId: 'g-1', especieId: null, posicion: 2, subId: 'PL1NN2',
    usuarioRegistro: 'u-1', createdAt: NOW,
  });

  const rows = await getTreesForGroup('g-1');

  expect(rows.map((r) => r.posicion)).toEqual([2, 1]);
  const conGps = rows.find((r) => r.id === 't-1')!;
  const sinGps = rows.find((r) => r.id === 't-2')!;
  expect(conGps.latitude).toBeCloseTo(-31.5);
  expect(conGps.longitude).toBeCloseTo(-60.7);
  expect(conGps.gpsAccuracy).toBeCloseTo(2.5);
  expect(conGps.especieCodigo).toBe('EUC');
  expect(sinGps.latitude).toBeNull();
  expect(sinGps.gpsAccuracy).toBeNull();
});

test('getTreeDetail incluye nombre científico y punto GPS completo (#155)', async () => {
  await mockTestDb.insert(species).values({
    id: 'esp-2', codigo: 'ALG', nombre: 'Algarrobo',
    nombreCientifico: 'Prosopis alba', createdAt: NOW,
  });
  await mockTestDb.insert(trees).values({
    id: 't-3', groupId: 'g-1', especieId: 'esp-2', posicion: 3, subId: 'PL1ALG3',
    usuarioRegistro: 'u-1', createdAt: NOW,
    latitude: -32.1, longitude: -61.2, gpsAccuracy: 4, gpsCapturedAt: NOW,
  });

  const [row] = await getTreeDetail('t-3');
  expect(row.especieNombre).toBe('Algarrobo');
  expect(row.especieNombreCientifico).toBe('Prosopis alba');
  expect(row.latitude).toBeCloseTo(-32.1);
  expect(row.longitude).toBeCloseTo(-61.2);
  expect(row.gpsAccuracy).toBeCloseTo(4);
});

test('getTreeDetail de un N/N devuelve especie nula (#155)', async () => {
  const [row] = await getTreeDetail('t-2');
  expect(row.especieId).toBeNull();
  expect(row.especieNombre).toBeNull();
  expect(row.especieNombreCientifico).toBeNull();
});
