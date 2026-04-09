/**
 * Integration tests: Tree registration data integrity
 * Tests: position auto-increment, SubID generation, undo, N/N trees, multi-species
 * Uses real SQLite via better-sqlite3 + drizzle migrations
 */

import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation, createTestSubGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import {
  plantations,
  subgroups,
  trees,
  species,
} from '../../src/database/schema';
import { eq, max, count, isNull } from 'drizzle-orm';
import Database from 'better-sqlite3';

let db: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

// Test data IDs (set in beforeEach)
let plantationId: string;
let subgroupId: string;
let subgroupCodigo: string;
let species1Id: string;
let species1Codigo: string;
let species2Id: string;
let species2Codigo: string;

beforeAll(() => {
  const result = createTestDb();
  db = result.db;
  sqlite = result.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  // Clear data in FK order
  await db.delete(trees);
  await db.delete(subgroups);
  await db.delete(plantations);
  await db.delete(species);

  // Seed base data
  const plantation = createTestPlantation();
  plantationId = plantation.id;
  await db.insert(plantations).values(plantation);

  const sp1 = createTestSpecies({ codigo: 'EUC', nombre: 'Eucalyptus' });
  species1Id = sp1.id;
  species1Codigo = sp1.codigo;
  await db.insert(species).values(sp1);

  const sp2 = createTestSpecies({ codigo: 'PIN', nombre: 'Pinus' });
  species2Id = sp2.id;
  species2Codigo = sp2.codigo;
  await db.insert(species).values(sp2);

  const sg = createTestSubGroup({ plantacionId: plantationId, codigo: 'L01', nombre: 'Linea 01' });
  subgroupId = sg.id;
  subgroupCodigo = sg.codigo;
  await db.insert(subgroups).values(sg);
});

/**
 * Replicates TreeRepository.insertTree logic: query MAX position, increment, insert.
 */
async function insertTree(params: {
  subgrupoId: string;
  subgrupoCodigo: string;
  especieId: string | null;
  especieCodigo: string;
  userId?: string;
}) {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion) })
    .from(trees)
    .where(eq(trees.subgrupoId, params.subgrupoId));

  const nextPosition = (maxResult?.maxPos ?? 0) + 1;
  const subId = `${params.subgrupoCodigo}${params.especieCodigo}${nextPosition}`;

  const id = `tree-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  await db.insert(trees).values({
    id,
    subgrupoId: params.subgrupoId,
    especieId: params.especieId,
    posicion: nextPosition,
    subId,
    fotoUrl: null,
    usuarioRegistro: params.userId ?? 'user-tecnico-1',
    createdAt: now,
  });

  return { id, posicion: nextPosition, subId };
}

/**
 * Replicates TreeRepository.deleteLastTree logic.
 */
async function deleteLastTree(subgrupoId: string): Promise<{ deleted: boolean }> {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion), id: trees.id })
    .from(trees)
    .where(eq(trees.subgrupoId, subgrupoId));

  if (maxResult?.id == null) return { deleted: false };

  await db.delete(trees).where(eq(trees.id, maxResult.id));
  return { deleted: true };
}

describe('Tree registration', () => {
  test('first tree gets position 1, second tree gets position 2 (auto-increment)', async () => {
    const result1 = await insertTree({
      subgrupoId: subgroupId,
      subgrupoCodigo: subgroupCodigo,
      especieId: species1Id,
      especieCodigo: species1Codigo,
    });
    expect(result1.posicion).toBe(1);

    const result2 = await insertTree({
      subgrupoId: subgroupId,
      subgrupoCodigo: subgroupCodigo,
      especieId: species1Id,
      especieCodigo: species1Codigo,
    });
    expect(result2.posicion).toBe(2);

    // Verify in DB
    const rows = await db.select().from(trees).where(eq(trees.subgrupoId, subgroupId));
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.posicion).sort()).toEqual([1, 2]);
  });

  test('SubID generated correctly: subgrupoCodigo + especieCodigo + posicion', async () => {
    const result = await insertTree({
      subgrupoId: subgroupId,
      subgrupoCodigo: 'L01',
      especieId: species1Id,
      especieCodigo: 'EUC',
    });

    expect(result.subId).toBe('L01EUC1');
    expect(result.posicion).toBe(1);

    const result2 = await insertTree({
      subgrupoId: subgroupId,
      subgrupoCodigo: 'L01',
      especieId: species2Id,
      especieCodigo: 'PIN',
    });
    expect(result2.subId).toBe('L01PIN2');

    // Verify in DB
    const rows = await db.select().from(trees).where(eq(trees.subgrupoId, subgroupId));
    const subIds = rows.map(r => r.subId);
    expect(subIds).toContain('L01EUC1');
    expect(subIds).toContain('L01PIN2');
  });

  test('delete last tree (undo), next tree reuses correct position', async () => {
    // Insert 3 trees
    await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });

    // Delete last (undo)
    const result = await deleteLastTree(subgroupId);
    expect(result.deleted).toBe(true);

    // Remaining: 2 trees at positions 1 and 2
    const rows = await db.select().from(trees).where(eq(trees.subgrupoId, subgroupId));
    expect(rows).toHaveLength(2);

    // Next insert should get position 3 (max was 2)
    const result4 = await insertTree({
      subgrupoId: subgroupId,
      subgrupoCodigo: 'L01',
      especieId: species2Id,
      especieCodigo: 'PIN',
    });
    expect(result4.posicion).toBe(3);
    expect(result4.subId).toBe('L01PIN3');
  });

  test('N/N tree (especieId=null) has correct sub_id with NN code', async () => {
    const nnResult = await insertTree({
      subgrupoId: subgroupId,
      subgrupoCodigo: 'L01',
      especieId: null,
      especieCodigo: 'NN',
    });

    expect(nnResult.subId).toBe('L01NN1');
    expect(nnResult.posicion).toBe(1);

    // Verify N/N tree is stored with null especieId
    const rows = await db.select().from(trees).where(eq(trees.subgrupoId, subgroupId));
    expect(rows[0].especieId).toBeNull();

    // Count unresolved N/N trees
    const [nnCount] = await db
      .select({ cnt: count() })
      .from(trees)
      .where(eq(trees.subgrupoId, subgroupId));
    // Verify we can find N/N trees via isNull query
    const nnRows = await db
      .select({ id: trees.id })
      .from(trees)
      .where(isNull(trees.especieId));
    expect(nnRows).toHaveLength(1);
  });

  test('multiple species in same subgroup each get correct position sequence', async () => {
    // Mix EUC and PIN trees
    await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species2Id, especieCodigo: 'PIN' });
    await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species2Id, especieCodigo: 'PIN' });

    const rows = await db.select().from(trees).where(eq(trees.subgrupoId, subgroupId));
    expect(rows).toHaveLength(4);

    // Positions should be sequential: 1, 2, 3, 4
    const positions = rows.map(r => r.posicion).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4]);

    // SubIDs reflect species + position
    const subIds = rows.map(r => r.subId);
    expect(subIds).toContain('L01EUC1');
    expect(subIds).toContain('L01PIN2');
    expect(subIds).toContain('L01EUC3');
    expect(subIds).toContain('L01PIN4');
  });

  test('tree count query returns accurate count per subgroup', async () => {
    // Insert trees in two subgroups
    const sg2 = createTestSubGroup({ plantacionId: plantationId, codigo: 'L02', nombre: 'Linea 02' });
    await db.insert(subgroups).values(sg2);

    for (let i = 0; i < 3; i++) {
      await insertTree({ subgrupoId: subgroupId, subgrupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    }
    for (let i = 0; i < 5; i++) {
      await insertTree({ subgrupoId: sg2.id, subgrupoCodigo: 'L02', especieId: species2Id, especieCodigo: 'PIN' });
    }

    const [sg1Count] = await db.select({ cnt: count() }).from(trees).where(eq(trees.subgrupoId, subgroupId));
    const [sg2Count] = await db.select({ cnt: count() }).from(trees).where(eq(trees.subgrupoId, sg2.id));

    expect(sg1Count.cnt).toBe(3);
    expect(sg2Count.cnt).toBe(5);
  });
});
