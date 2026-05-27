/**
 * Integration tests: ParcelaRepository
 * Uses real SQLite via better-sqlite3 + drizzle migrations (incluida 0012).
 * Mocks `../../src/database/client` para que el repo use el mockTestDb.
 */
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import Database from 'better-sqlite3';
import { plantations, parcelas, groups, trees } from '../../src/database/schema';
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

// We must import the repo AFTER the mock is declared
import {
  createParcela,
  updateParcela,
  deleteParcela,
  restoreParcela,
  findById,
  findByPlantacion,
  getSyncableParcelas,
  markParcelaSynced,
} from '../../src/repositories/ParcelaRepository';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  // Physical delete in FK order to clear tombstones too
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(plantations);
});

async function seedPlantation(overrides?: Parameters<typeof createTestPlantation>[0]): Promise<string> {
  const p = createTestPlantation(overrides);
  await mockTestDb.insert(plantations).values(p);
  return p.id;
}

describe('ParcelaRepository', () => {
  describe('createParcela', () => {
    test('creates parcela con success=true, pendingSync=true, deletedAt=null', async () => {
      const plantacionId = await seedPlantation();
      const result = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      expect(result).toMatchObject({ success: true });
      if (!result.success) return;
      const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, result.id));
      expect(row.pendingSync).toBe(true);
      expect(row.deletedAt).toBeNull();
      expect(row.codigo).toBe('L1');
    });

    test('uppercases codigo', async () => {
      const plantacionId = await seedPlantation();
      const result = await createParcela({ plantacionId, nombre: 'Lote x', codigo: 'lx' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, result.id));
      expect(row.codigo).toBe('LX');
    });

    test('nombre duplicado en misma plantacion → nombre_duplicate', async () => {
      const plantacionId = await seedPlantation();
      await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      const r2 = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L2' });
      expect(r2).toEqual({ success: false, error: 'nombre_duplicate' });
    });

    test('codigo duplicado en misma plantacion → codigo_duplicate', async () => {
      const plantacionId = await seedPlantation();
      await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      const r2 = await createParcela({ plantacionId, nombre: 'Lote 2', codigo: 'L1' });
      expect(r2).toEqual({ success: false, error: 'codigo_duplicate' });
    });

    test('nombre Y codigo duplicados → both_duplicate', async () => {
      const plantacionId = await seedPlantation();
      await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      const r2 = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      expect(r2).toEqual({ success: false, error: 'both_duplicate' });
    });

    test('nombre duplicado en OTRA plantacion → success (unicidad per-plantacion)', async () => {
      const p1 = await seedPlantation({ lugar: 'Campo A' });
      const p2 = await seedPlantation({ lugar: 'Campo B' });
      await createParcela({ plantacionId: p1, nombre: 'Lote 1', codigo: 'L1' });
      const r = await createParcela({ plantacionId: p2, nombre: 'Lote 1', codigo: 'L1' });
      expect(r.success).toBe(true);
    });

    test('descripcion 10001 chars → descripcion_too_long', async () => {
      const plantacionId = await seedPlantation();
      const r = await createParcela({
        plantacionId, nombre: 'X', codigo: 'X', descripcion: 'a'.repeat(10001),
      });
      expect(r).toEqual({ success: false, error: 'descripcion_too_long' });
    });

    test('descripcion 10000 chars → success', async () => {
      const plantacionId = await seedPlantation();
      const r = await createParcela({
        plantacionId, nombre: 'X', codigo: 'X', descripcion: 'a'.repeat(10000),
      });
      expect(r.success).toBe(true);
    });
  });

  describe('updateParcela', () => {
    test('mantiene pendingSync=true y actualiza updatedAt', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      if (!c.success) throw new Error('seed failed');
      // Mark synced first so we can detect pending flip
      await markParcelaSynced(c.id);
      const before = await findById(c.id);
      await new Promise((res) => setTimeout(res, 10));
      const r = await updateParcela(c.id, { nombre: 'Lote 1 Edit', codigo: 'L1' });
      expect(r.success).toBe(true);
      const after = await findById(c.id);
      expect(after!.pendingSync).toBe(true);
      expect(after!.updatedAt >= before!.updatedAt).toBe(true);
      expect(after!.nombre).toBe('Lote 1 Edit');
    });

    test('excluye id propio al validar unicidad (no auto-colision)', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      if (!c.success) throw new Error('seed failed');
      const r = await updateParcela(c.id, { nombre: 'Lote 1', codigo: 'L1' }); // same as itself
      expect(r.success).toBe(true);
    });

    test('sobre parcela tombstoneada → not_found', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      if (!c.success) throw new Error('seed failed');
      await deleteParcela(c.id);
      const r = await updateParcela(c.id, { nombre: 'Lote 1', codigo: 'L1' });
      expect(r).toEqual({ success: false, error: 'not_found' });
    });
  });

  describe('deleteParcela (soft-delete tombstone)', () => {
    test('con 0 grupos hijos → deleted=true, fila persiste con deletedAt set y pendingSync=true', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      if (!c.success) throw new Error('seed failed');
      await markParcelaSynced(c.id);
      const r = await deleteParcela(c.id);
      expect(r).toEqual({ deleted: true });
      const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, c.id));
      expect(row).toBeDefined();
      expect(row.deletedAt).not.toBeNull();
      expect(row.pendingSync).toBe(true);
    });

    test('con ≥1 grupo hijo → has_children + childCount', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'Lote 1', codigo: 'L1' });
      if (!c.success) throw new Error('seed failed');
      // Insert one group with parcelaId pointing to the new parcela
      await mockTestDb.insert(groups).values({
        id: 'g-1',
        plantacionId,
        parcelaId: c.id,
        nombre: 'Linea A',
        codigo: 'LA',
        tipo: 'linea',
        estado: 'activa',
        usuarioCreador: 'u1',
        createdAt: new Date().toISOString(),
        pendingSync: false,
      });
      const r = await deleteParcela(c.id);
      expect(r).toEqual({ deleted: false, error: 'has_children', childCount: 1 });
      const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, c.id));
      expect(row.deletedAt).toBeNull();
    });

    test('sobre parcela ya tombstoneada → not_found (idempotencia)', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'L', codigo: 'L' });
      if (!c.success) throw new Error('seed failed');
      await deleteParcela(c.id);
      const r2 = await deleteParcela(c.id);
      expect(r2).toEqual({ deleted: false, error: 'not_found' });
    });
  });

  describe('restoreParcela', () => {
    test('parcela tombstoneada → restored=true, deletedAt=null, pendingSync=true', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'L', codigo: 'L' });
      if (!c.success) throw new Error('seed failed');
      await deleteParcela(c.id);
      const r = await restoreParcela(c.id);
      expect(r).toEqual({ restored: true });
      const after = await findById(c.id);
      expect(after).not.toBeNull();
      expect(after!.deletedAt).toBeNull();
      expect(after!.pendingSync).toBe(true);
    });

    // DEFERRED: "restore que causaria colision unicidad" requires the SQLite
    // unique indexes on (plantacion_id, nombre/codigo) to be PARTIAL indexes
    // that exclude tombstoned rows. Until then, the SQL constraint blocks
    // duplicates BEFORE the repo guard can fire, so the collision scenario
    // is unreachable from app code paths. The repo's validateParcelaUniqueness
    // logic (filters deletedAt IS NULL) is exercised by createParcela /
    // updateParcela tests above. Tracked for Phase 16-03 or later.

    test('restore sobre id inexistente → not_found', async () => {
      const r = await restoreParcela('does-not-exist');
      expect(r).toEqual({ restored: false, error: 'not_found' });
    });
  });

  describe('findByPlantacion / findById', () => {
    test('findByPlantacion orden por createdAt ASC y omite tombstoneadas', async () => {
      const plantacionId = await seedPlantation();
      const a = await createParcela({ plantacionId, nombre: 'A', codigo: 'A' });
      await new Promise((res) => setTimeout(res, 5));
      const b = await createParcela({ plantacionId, nombre: 'B', codigo: 'B' });
      await new Promise((res) => setTimeout(res, 5));
      const c = await createParcela({ plantacionId, nombre: 'C', codigo: 'C' });
      if (!a.success || !b.success || !c.success) throw new Error('seed failed');
      await deleteParcela(b.id);
      const list = await findByPlantacion(plantacionId);
      expect(list.map((p) => p.id)).toEqual([a.id, c.id]);
    });

    test('findById sobre tombstoneada → null; con includeDeleted=true → la fila', async () => {
      const plantacionId = await seedPlantation();
      const c = await createParcela({ plantacionId, nombre: 'L', codigo: 'L' });
      if (!c.success) throw new Error('seed failed');
      await deleteParcela(c.id);
      expect(await findById(c.id)).toBeNull();
      const withDeleted = await findById(c.id, { includeDeleted: true });
      expect(withDeleted).not.toBeNull();
      expect(withDeleted!.deletedAt).not.toBeNull();
    });
  });

  describe('getSyncableParcelas', () => {
    test('filtra pendingSync=true e incluye tombstoneadas', async () => {
      const plantacionId = await seedPlantation();
      const a = await createParcela({ plantacionId, nombre: 'A', codigo: 'A' });
      const b = await createParcela({ plantacionId, nombre: 'B', codigo: 'B' });
      if (!a.success || !b.success) throw new Error('seed failed');
      await markParcelaSynced(a.id); // a no longer pending
      await deleteParcela(b.id); // b tombstoneada pero pending
      const syncable = await getSyncableParcelas(plantacionId);
      const ids = syncable.map((p) => p.id);
      expect(ids).toContain(b.id);
      expect(ids).not.toContain(a.id);
    });
  });
});
