/**
 * Integration tests: parcelaQueries
 * Real SQLite via better-sqlite3 + drizzle migrations.
 */
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import Database from 'better-sqlite3';
import { plantations, parcelas, groups, trees } from '../../src/database/schema';
import { localNow } from '../../src/utils/dateUtils';

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

import {
  listByPlantacionWithStats,
  countGroupsByParcela,
  countTreesByParcela,
  countNNByParcela,
  getParcelaStats,
} from '../../src/queries/parcelaQueries';
import { createParcela, deleteParcela } from '../../src/repositories/ParcelaRepository';
import { eq } from 'drizzle-orm';

// Force-tombstones a parcela bypassing the has_children guard — used to set up
// pure query-filter scenarios where children must remain.
async function forceTombstone(parcelaId: string): Promise<void> {
  await mockTestDb.update(parcelas)
    .set({ deletedAt: localNow(), pendingSync: true })
    .where(eq(parcelas.id, parcelaId));
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
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(plantations);
});

async function seedPlantation(): Promise<string> {
  const p = createTestPlantation();
  await mockTestDb.insert(plantations).values(p);
  return p.id;
}

async function seedGroup(plantacionId: string, parcelaId: string, codigo: string, pendingSync = false): Promise<string> {
  const id = `g-${Math.random().toString(36).slice(2, 10)}`;
  await mockTestDb.insert(groups).values({
    id,
    plantacionId,
    parcelaId,
    nombre: 'N-' + codigo,
    codigo,
    tipo: 'linea',
    estado: 'activa',
    usuarioCreador: 'u1',
    createdAt: localNow(),
    pendingSync,
  });
  return id;
}

async function seedTree(groupId: string, posicion: number): Promise<void> {
  await mockTestDb.insert(trees).values({
    id: `t-${Math.random().toString(36).slice(2, 10)}`,
    groupId,
    especieId: null,
    posicion,
    subId: `S-${posicion}`,
    fotoUrl: null,
    fotoSynced: true,
    plantacionId: null,
    globalId: null,
    usuarioRegistro: 'u1',
    createdAt: localNow(),
    conflictEspecieId: null,
    conflictEspecieNombre: null,
  });
}

describe('parcelaQueries', () => {
  test('listByPlantacionWithStats: 0 stats si parcela sin grupos ni arboles', async () => {
    const plantacionId = await seedPlantation();
    const c = await createParcela({ plantacionId, nombre: 'P1', codigo: 'P1' });
    if (!c.success) throw new Error('seed failed');
    const list = await listByPlantacionWithStats(plantacionId);
    expect(list).toHaveLength(1);
    expect(list[0].gruposCount).toBe(0);
    expect(list[0].treesCount).toBe(0);
    expect(list[0].pendingSyncBelow).toBe(false);
  });

  test('listByPlantacionWithStats: 2 grupos y 5 arboles -> gruposCount=2, treesCount=5', async () => {
    const plantacionId = await seedPlantation();
    const c = await createParcela({ plantacionId, nombre: 'P1', codigo: 'P1' });
    if (!c.success) throw new Error('seed failed');
    const g1 = await seedGroup(plantacionId, c.id, 'G1');
    const g2 = await seedGroup(plantacionId, c.id, 'G2');
    await seedTree(g1, 1);
    await seedTree(g1, 2);
    await seedTree(g1, 3);
    await seedTree(g2, 1);
    await seedTree(g2, 2);
    const list = await listByPlantacionWithStats(plantacionId);
    expect(list).toHaveLength(1);
    expect(list[0].gruposCount).toBe(2);
    expect(list[0].treesCount).toBe(5);
  });

  test('pendingSyncBelow=true si algun grupo tiene pendingSync=true', async () => {
    const plantacionId = await seedPlantation();
    const c = await createParcela({ plantacionId, nombre: 'P1', codigo: 'P1' });
    if (!c.success) throw new Error('seed failed');
    await seedGroup(plantacionId, c.id, 'G1', true); // pendingSync=true
    const list = await listByPlantacionWithStats(plantacionId);
    expect(list[0].pendingSyncBelow).toBe(true);
  });

  test('parcela tombstoneada NO aparece en listByPlantacionWithStats', async () => {
    const plantacionId = await seedPlantation();
    const a = await createParcela({ plantacionId, nombre: 'A', codigo: 'A' });
    const b = await createParcela({ plantacionId, nombre: 'B', codigo: 'B' });
    if (!a.success || !b.success) throw new Error('seed failed');
    await deleteParcela(b.id);
    const list = await listByPlantacionWithStats(plantacionId);
    expect(list.map((p) => p.id)).toEqual([a.id]);
  });

  test('countGroupsByParcela excluye parcelas tombstoneadas', async () => {
    const plantacionId = await seedPlantation();
    const a = await createParcela({ plantacionId, nombre: 'A', codigo: 'A' });
    const b = await createParcela({ plantacionId, nombre: 'B', codigo: 'B' });
    if (!a.success || !b.success) throw new Error('seed failed');
    await seedGroup(plantacionId, a.id, 'GA');
    await seedGroup(plantacionId, b.id, 'GB');
    await forceTombstone(b.id);
    const counts = await countGroupsByParcela(plantacionId);
    const ids = counts.map((c) => c.parcelaId);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  test('countTreesByParcela excluye parcelas tombstoneadas', async () => {
    const plantacionId = await seedPlantation();
    const a = await createParcela({ plantacionId, nombre: 'A', codigo: 'A' });
    const b = await createParcela({ plantacionId, nombre: 'B', codigo: 'B' });
    if (!a.success || !b.success) throw new Error('seed failed');
    const ga = await seedGroup(plantacionId, a.id, 'GA');
    const gb = await seedGroup(plantacionId, b.id, 'GB');
    await seedTree(ga, 1);
    await seedTree(gb, 1);
    await forceTombstone(b.id);
    const counts = await countTreesByParcela(plantacionId);
    const ids = counts.map((c) => c.parcelaId);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  test('getParcelaStats sobre tombstoneada -> null', async () => {
    const plantacionId = await seedPlantation();
    const c = await createParcela({ plantacionId, nombre: 'P', codigo: 'P' });
    if (!c.success) throw new Error('seed failed');
    await deleteParcela(c.id);
    const stats = await getParcelaStats(c.id);
    expect(stats).toBeNull();
  });

  test('getParcelaStats sobre activa retorna counts correctos', async () => {
    const plantacionId = await seedPlantation();
    const c = await createParcela({ plantacionId, nombre: 'P', codigo: 'P' });
    if (!c.success) throw new Error('seed failed');
    const g = await seedGroup(plantacionId, c.id, 'G1');
    await seedTree(g, 1);
    await seedTree(g, 2);
    const stats = await getParcelaStats(c.id);
    // seedTree inserta árboles con especieId null → ambos son N/N.
    expect(stats).toEqual({ gruposCount: 1, treesCount: 2, nnCount: 2, pendingSyncBelow: false });
  });

  test('countNNByParcela cuenta solo árboles N/N (especieId null) por parcela', async () => {
    const plantacionId = await seedPlantation();
    const p = await createParcela({ plantacionId, nombre: 'P', codigo: 'P' });
    if (!p.success) throw new Error('seed failed');
    const g = await seedGroup(plantacionId, p.id, 'G1');
    await seedTree(g, 1);
    await seedTree(g, 2);
    const counts = await countNNByParcela(plantacionId);
    const row = counts.find((c) => c.parcelaId === p.id);
    expect(row?.count).toBe(2);
    // En listByPlantacionWithStats el badge sale de nnCount.
    const list = await listByPlantacionWithStats(plantacionId);
    expect(list.find((x) => x.id === p.id)?.nnCount).toBe(2);
  });
});
