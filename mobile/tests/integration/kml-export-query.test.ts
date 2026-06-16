/**
 * Integration test: getKmlExportRows (issue #101). SQLite real.
 * Solo árboles con coordenadas; N/N incluidos con especie null.
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

import { getKmlExportRows } from '../../src/queries/exportQueries';

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
  // Con punto + especie
  await mockTestDb.insert(trees).values({
    id: 't-1', groupId: 'g-1', especieId: 'esp-1', posicion: 1, subId: 'PL1EUC1',
    usuarioRegistro: 'u-1', createdAt: NOW,
    latitude: -31.5, longitude: -60.7, gpsAccuracy: 2.5, gpsCapturedAt: NOW,
  });
  // Con punto, N/N
  await mockTestDb.insert(trees).values({
    id: 't-2', groupId: 'g-1', especieId: null, posicion: 2, subId: 'PL1NN2',
    usuarioRegistro: 'u-1', createdAt: NOW,
    latitude: -31.6, longitude: -60.8, gpsAccuracy: 9.0, gpsCapturedAt: NOW,
  });
  // Sin punto (se omite)
  await mockTestDb.insert(trees).values({
    id: 't-3', groupId: 'g-1', especieId: 'esp-1', posicion: 3, subId: 'PL1EUC3',
    usuarioRegistro: 'u-1', createdAt: NOW,
  });
});

afterAll(() => {
  closeTestDb(sqlite);
});

test('devuelve solo árboles con coordenadas, N/N incluido con especie null', async () => {
  const rows = await getKmlExportRows('plant-1');

  expect(rows.map((r) => r.subId)).toEqual(['PL1EUC1', 'PL1NN2']);
  const conEspecie = rows[0];
  expect(conEspecie.especieNombre).toBe('Eucalipto');
  expect(conEspecie.parcelaNombre).toBe('Lote A');
  expect(conEspecie.latitude).toBeCloseTo(-31.5);
  expect(conEspecie.longitude).toBeCloseTo(-60.7);
  expect(conEspecie.gpsAccuracy).toBeCloseTo(2.5);
  expect(rows[1].especieNombre).toBeNull();
});

test('plantación sin puntos devuelve lista vacía (el servicio muestra mensaje)', async () => {
  const rows = await getKmlExportRows('plant-inexistente');
  expect(rows).toEqual([]);
});
