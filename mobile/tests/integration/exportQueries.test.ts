/**
 * Integration tests: exportQueries.getExportRows
 * Real SQLite via better-sqlite3 + drizzle migrations.
 *
 * Verifies LEFT JOIN to parcelas:
 *  - Tree in a group with parcela → parcelaNombre matches parcela.nombre
 *  - Tree in a legacy group without parcela → parcelaNombre is null
 *  - Rows ordered by globalId ASC
 * Covers: EXPO-PARC-01, EXPO-PARC-02, D-18-10
 */
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import Database from 'better-sqlite3';
import {
  plantations,
  parcelas,
  groups,
  trees,
  species,
} from '../../src/database/schema';
import { localNow } from '../../src/utils/dateUtils';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { getExportRows } from '../../src/queries/exportQueries';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(plantations);
  await mockTestDb.delete(species);
});

async function seedSpecies(codigo = 'PI'): Promise<string> {
  const id = `sp-${Math.random().toString(36).slice(2, 8)}`;
  await mockTestDb.insert(species).values({
    id,
    codigo,
    nombre: 'Pino',
    nombreCientifico: null,
    createdAt: localNow(),
  });
  return id;
}

async function seedTree(
  groupId: string,
  especieId: string,
  globalId: number,
  posicion: number,
): Promise<void> {
  await mockTestDb.insert(trees).values({
    id: `t-${globalId}`,
    groupId,
    especieId,
    posicion,
    subId: `P1-G1-PI-${posicion}`,
    fotoUrl: null,
    fotoSynced: false,
    plantacionId: posicion,
    globalId,
    usuarioRegistro: 'u1',
    createdAt: localNow(),
  });
}

describe('exportQueries.getExportRows', () => {
  it('returns parcelaNombre when group has parcelaId (happy path)', async () => {
    const plantation = createTestPlantation({ lugar: 'Campo Test' });
    await mockTestDb.insert(plantations).values(plantation);

    await mockTestDb.insert(parcelas).values({
      id: 'parc-1',
      plantacionId: plantation.id,
      nombre: 'Parcela 1',
      codigo: 'P1',
      descripcion: null,
      pendingSync: false,
      createdAt: localNow(),
      updatedAt: localNow(),
      deletedAt: null,
    });

    await mockTestDb.insert(groups).values({
      id: 'g-1',
      plantacionId: plantation.id,
      parcelaId: 'parc-1',
      nombre: 'Linea A',
      codigo: 'LA',
      tipo: 'linea',
      estado: 'activa',
      usuarioCreador: 'u1',
      createdAt: localNow(),
      pendingSync: false,
    });

    const especieId = await seedSpecies('PI');
    await seedTree('g-1', especieId, 10, 1);
    await seedTree('g-1', especieId, 11, 2);

    const rows = await getExportRows(plantation.id);

    expect(rows).toHaveLength(2);
    expect(rows[0].parcelaNombre).toBe('Parcela 1');
    expect(rows[0].plantacionLugar).toBe('Campo Test');
    expect(rows[0].lugar).toBe('Campo Test');
    expect(rows[0].grupoNombre).toBe('Linea A');
    expect(rows[1].parcelaNombre).toBe('Parcela 1');
  });

  it('returns parcelaNombre = null when group has parcelaId = null (legacy)', async () => {
    const plantation = createTestPlantation({ lugar: 'Legacy Field' });
    await mockTestDb.insert(plantations).values(plantation);

    await mockTestDb.insert(groups).values({
      id: 'g-legacy',
      plantacionId: plantation.id,
      parcelaId: null,
      nombre: 'Linea Legacy',
      codigo: 'LL',
      tipo: 'linea',
      estado: 'activa',
      usuarioCreador: 'u1',
      createdAt: localNow(),
      pendingSync: false,
    });

    const especieId = await seedSpecies('EU');
    await seedTree('g-legacy', especieId, 1, 1);

    const rows = await getExportRows(plantation.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].parcelaNombre).toBeNull();
    expect(rows[0].plantacionLugar).toBe('Legacy Field');
    expect(rows[0].grupoNombre).toBe('Linea Legacy');
  });

  it('orders rows by globalId ASC', async () => {
    const plantation = createTestPlantation();
    await mockTestDb.insert(plantations).values(plantation);

    await mockTestDb.insert(parcelas).values({
      id: 'parc-2',
      plantacionId: plantation.id,
      nombre: 'Parcela 1',
      codigo: 'P1',
      descripcion: null,
      pendingSync: false,
      createdAt: localNow(),
      updatedAt: localNow(),
      deletedAt: null,
    });

    await mockTestDb.insert(groups).values({
      id: 'g-2',
      plantacionId: plantation.id,
      parcelaId: 'parc-2',
      nombre: 'G2',
      codigo: 'G2',
      tipo: 'linea',
      estado: 'activa',
      usuarioCreador: 'u1',
      createdAt: localNow(),
      pendingSync: false,
    });

    const especieId = await seedSpecies('OL');
    await seedTree('g-2', especieId, 30, 3);
    await seedTree('g-2', especieId, 10, 1);
    await seedTree('g-2', especieId, 20, 2);

    const rows = await getExportRows(plantation.id);

    expect(rows.map((r) => r.globalId)).toEqual([10, 20, 30]);
  });
});
