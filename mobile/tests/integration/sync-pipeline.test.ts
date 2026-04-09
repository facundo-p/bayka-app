/**
 * Integration tests: Sync pipeline
 * Tests: atomic insert of subgroup+trees, duplicate detection, sincronizada state
 * Uses real SQLite via better-sqlite3 + drizzle migrations
 *
 * NOTE: drizzle-orm/better-sqlite3 transactions are synchronous-only.
 * Use synchronous drizzle API (or sqlite.transaction) for transaction tests.
 */

import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation, createTestSubGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import {
  plantations,
  subgroups,
  trees,
  species,
} from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';

let db: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

beforeAll(() => {
  const result = createTestDb();
  db = result.db;
  sqlite = result.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  // Clear data in FK order (respecting: trees -> subgroups -> plantations -> species)
  await db.delete(trees);
  await db.delete(subgroups);
  await db.delete(plantations);
  await db.delete(species);
});

describe('Sync pipeline', () => {
  test('inserts subgroup + 5 trees sequentially, all rows present after commit', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);
    const sp = createTestSpecies({ codigo: 'EUC' });
    await db.insert(species).values(sp);

    const sg = createTestSubGroup({ plantacionId: plantation.id, estado: 'finalizada' });
    await db.insert(subgroups).values(sg);

    for (let i = 1; i <= 5; i++) {
      const tree = createTestTree({
        subgrupoId: sg.id,
        especieId: sp.id,
        posicion: i,
        subId: `${sg.codigo}EUC${i}`,
      });
      await db.insert(trees).values(tree);
    }

    const sgRows = await db.select().from(subgroups).where(eq(subgroups.id, sg.id));
    expect(sgRows).toHaveLength(1);

    const treeRows = await db.select().from(trees).where(eq(trees.subgrupoId, sg.id));
    expect(treeRows).toHaveLength(5);
  });

  test('duplicate tree PK fails and data rollback verified (atomicity via sqlite.transaction)', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sg = createTestSubGroup({ plantacionId: plantation.id });

    let threw = false;
    // Use sqlite.transaction (synchronous) for proper atomicity testing
    const insertWithDuplicate = sqlite.transaction(() => {
      // We use the raw sqlite prepare/run here to test atomicity directly
      const insertSg = sqlite.prepare(
        'INSERT INTO subgroups (id, plantacion_id, nombre, codigo, tipo, estado, usuario_creador, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      insertSg.run(sg.id, sg.plantacionId, sg.nombre, sg.codigo, sg.tipo, sg.estado, sg.usuarioCreador, sg.createdAt);

      const insertTree = sqlite.prepare(
        'INSERT INTO trees (id, subgrupo_id, especie_id, posicion, sub_id, foto_url, plantacion_id, global_id, usuario_registro, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const now = new Date().toISOString();
      insertTree.run('tree-1', sg.id, null, 1, 'LA-NN-1', null, null, null, 'user1', now);
      // Insert duplicate (same id) to trigger PK error
      insertTree.run('tree-1', sg.id, null, 2, 'LA-NN-2', null, null, null, 'user1', now);
    });

    try {
      insertWithDuplicate();
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);

    // Transaction was rolled back — subgroup should NOT exist
    const sgRows = await db.select().from(subgroups).where(eq(subgroups.id, sg.id));
    expect(sgRows).toHaveLength(0);

    const treeRows = await db.select().from(trees).where(eq(trees.subgrupoId, sg.id));
    expect(treeRows).toHaveLength(0);
  });

  test('duplicate subgroup codigo in same plantation is detected (UNIQUE constraint)', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sg1 = createTestSubGroup({ plantacionId: plantation.id, codigo: 'L01', nombre: 'Linea 01' });
    await db.insert(subgroups).values(sg1);

    // Try to insert another subgroup with same codigo (different id)
    const sg2 = createTestSubGroup({ plantacionId: plantation.id, codigo: 'L01', nombre: 'Linea 01 Dup' });

    let threw = false;
    try {
      await db.insert(subgroups).values(sg2);
    } catch (e: any) {
      threw = true;
      expect(e.message).toMatch(/UNIQUE constraint failed/);
    }
    expect(threw).toBe(true);

    // Original subgroup still intact
    const rows = await db.select().from(subgroups).where(eq(subgroups.plantacionId, plantation.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sg1.id);
  });

  test('after sync marks subgroup as sincronizada, trees remain queryable', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);
    const sp = createTestSpecies({ codigo: 'PIN' });
    await db.insert(species).values(sp);

    const sg = createTestSubGroup({ plantacionId: plantation.id, estado: 'finalizada' });
    await db.insert(subgroups).values(sg);

    for (let i = 1; i <= 3; i++) {
      const tree = createTestTree({
        subgrupoId: sg.id,
        especieId: sp.id,
        posicion: i,
        subId: `${sg.codigo}PIN${i}`,
      });
      await db.insert(trees).values(tree);
    }

    // Mark as sincronizada (simulating sync completion)
    await db.update(subgroups).set({ estado: 'sincronizada' }).where(eq(subgroups.id, sg.id));

    const sgRows = await db.select().from(subgroups).where(eq(subgroups.id, sg.id));
    expect(sgRows[0].estado).toBe('sincronizada');

    const treeRows = await db.select().from(trees).where(eq(trees.subgrupoId, sg.id));
    expect(treeRows).toHaveLength(3);
  });
});
