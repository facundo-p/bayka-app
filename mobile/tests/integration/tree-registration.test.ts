/**
 * Integration tests: Tree registration data integrity
 * Tests: position auto-increment, SubID generation, undo, N/N trees, multi-species
 * Uses real SQLite via better-sqlite3 + drizzle migrations
 */

import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import {
  plantations,
  parcelas,
  groups,
  trees,
  species,
} from '../../src/database/schema';
import { eq, max, count, isNull } from 'drizzle-orm';
import Database from 'better-sqlite3';

let db: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

// Test data IDs (set in beforeEach)
let plantationId: string;
let groupId: string;
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
  await db.delete(groups);
  await db.delete(parcelas);
  await db.delete(plantations);
  await db.delete(species);

  const plantation = createTestPlantation();
  plantationId = plantation.id;
  await db.insert(plantations).values(plantation);

  // #90: parcela obligatoria — los groups de la factory referencian 'parcela-default'.
  await db.insert(parcelas).values(createTestParcela({ id: 'parcela-default', plantacionId: plantationId }));

  const sp1 = createTestSpecies({ codigo: 'EUC', nombre: 'Eucalyptus' });
  species1Id = sp1.id;
  species1Codigo = sp1.codigo;
  await db.insert(species).values(sp1);

  const sp2 = createTestSpecies({ codigo: 'PIN', nombre: 'Pinus' });
  species2Id = sp2.id;
  species2Codigo = sp2.codigo;
  await db.insert(species).values(sp2);

  const sg = createTestGroup({ plantacionId: plantationId, codigo: 'L01', nombre: 'Linea 01' });
  groupId = sg.id;
  subgroupCodigo = sg.codigo;
  await db.insert(groups).values(sg);
});

/**
 * Replicates TreeRepository.insertTree logic: query MAX position, increment, insert.
 */
async function insertTree(params: {
  grupoId: string;
  grupoCodigo: string;
  especieId: string | null;
  especieCodigo: string;
  userId?: string;
}) {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion) })
    .from(trees)
    .where(eq(trees.groupId, params.grupoId));

  const nextPosition = (maxResult?.maxPos ?? 0) + 1;
  const subId = `${params.grupoCodigo}${params.especieCodigo}${nextPosition}`;

  const id = `tree-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  await db.insert(trees).values({
    id,
    groupId: params.grupoId,
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
async function deleteLastTree(grupoId: string): Promise<{ deleted: boolean }> {
  const [maxResult] = await db
    .select({ maxPos: max(trees.posicion), id: trees.id })
    .from(trees)
    .where(eq(trees.groupId, grupoId));

  if (maxResult?.id == null) return { deleted: false };

  await db.delete(trees).where(eq(trees.id, maxResult.id));
  return { deleted: true };
}

describe('Tree registration', () => {
  test('first tree gets position 1, second tree gets position 2 (auto-increment)', async () => {
    const result1 = await insertTree({
      grupoId: groupId,
      grupoCodigo: subgroupCodigo,
      especieId: species1Id,
      especieCodigo: species1Codigo,
    });
    expect(result1.posicion).toBe(1);

    const result2 = await insertTree({
      grupoId: groupId,
      grupoCodigo: subgroupCodigo,
      especieId: species1Id,
      especieCodigo: species1Codigo,
    });
    expect(result2.posicion).toBe(2);

    const rows = await db.select().from(trees).where(eq(trees.groupId, groupId));
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.posicion).sort()).toEqual([1, 2]);
  });

  test('SubID generated correctly: grupoCodigo + especieCodigo + posicion', async () => {
    const result = await insertTree({
      grupoId: groupId,
      grupoCodigo: 'L01',
      especieId: species1Id,
      especieCodigo: 'EUC',
    });

    expect(result.subId).toBe('L01EUC1');
    expect(result.posicion).toBe(1);

    const result2 = await insertTree({
      grupoId: groupId,
      grupoCodigo: 'L01',
      especieId: species2Id,
      especieCodigo: 'PIN',
    });
    expect(result2.subId).toBe('L01PIN2');

    const rows = await db.select().from(trees).where(eq(trees.groupId, groupId));
    const subIds = rows.map(r => r.subId);
    expect(subIds).toContain('L01EUC1');
    expect(subIds).toContain('L01PIN2');
  });

  test('delete last tree (undo), next tree reuses correct position', async () => {
    await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });

    const result = await deleteLastTree(groupId);
    expect(result.deleted).toBe(true);

    const rows = await db.select().from(trees).where(eq(trees.groupId, groupId));
    expect(rows).toHaveLength(2);

    // max era 2 tras el undo → el próximo debe tomar posición 3
    const result4 = await insertTree({
      grupoId: groupId,
      grupoCodigo: 'L01',
      especieId: species2Id,
      especieCodigo: 'PIN',
    });
    expect(result4.posicion).toBe(3);
    expect(result4.subId).toBe('L01PIN3');
  });

  test('N/N tree (especieId=null) has correct sub_id with NN code', async () => {
    const nnResult = await insertTree({
      grupoId: groupId,
      grupoCodigo: 'L01',
      especieId: null,
      especieCodigo: 'NN',
    });

    expect(nnResult.subId).toBe('L01NN1');
    expect(nnResult.posicion).toBe(1);

    const rows = await db.select().from(trees).where(eq(trees.groupId, groupId));
    expect(rows[0].especieId).toBeNull();

    const [nnCount] = await db
      .select({ cnt: count() })
      .from(trees)
      .where(eq(trees.groupId, groupId));
    // Los N/N deben poder encontrarse vía isNull
    const nnRows = await db
      .select({ id: trees.id })
      .from(trees)
      .where(isNull(trees.especieId));
    expect(nnRows).toHaveLength(1);
  });

  test('multiple species in same subgroup each get correct position sequence', async () => {
    await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species2Id, especieCodigo: 'PIN' });
    await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species2Id, especieCodigo: 'PIN' });

    const rows = await db.select().from(trees).where(eq(trees.groupId, groupId));
    expect(rows).toHaveLength(4);

    const positions = rows.map(r => r.posicion).sort((a, b) => a - b);
    expect(positions).toEqual([1, 2, 3, 4]);

    const subIds = rows.map(r => r.subId);
    expect(subIds).toContain('L01EUC1');
    expect(subIds).toContain('L01PIN2');
    expect(subIds).toContain('L01EUC3');
    expect(subIds).toContain('L01PIN4');
  });

  test('tree count query returns accurate count per subgroup', async () => {
    const sg2 = createTestGroup({ plantacionId: plantationId, codigo: 'L02', nombre: 'Linea 02' });
    await db.insert(groups).values(sg2);

    for (let i = 0; i < 3; i++) {
      await insertTree({ grupoId: groupId, grupoCodigo: 'L01', especieId: species1Id, especieCodigo: 'EUC' });
    }
    for (let i = 0; i < 5; i++) {
      await insertTree({ grupoId: sg2.id, grupoCodigo: 'L02', especieId: species2Id, especieCodigo: 'PIN' });
    }

    const [sg1Count] = await db.select({ cnt: count() }).from(trees).where(eq(trees.groupId, groupId));
    const [sg2Count] = await db.select({ cnt: count() }).from(trees).where(eq(trees.groupId, sg2.id));

    expect(sg1Count.cnt).toBe(3);
    expect(sg2Count.cnt).toBe(5);
  });
});
