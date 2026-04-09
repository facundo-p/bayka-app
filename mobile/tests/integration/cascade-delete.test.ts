/**
 * Integration tests: Cascade delete (deletePlantationLocally pattern)
 * Tests: plantation + subgroups + trees + plantation_species + plantation_users all removed
 * Uses real SQLite via better-sqlite3 + drizzle migrations
 *
 * NOTE: drizzle-orm/better-sqlite3 transactions are synchronous-only.
 * Uses sqlite.transaction() for proper atomic cascade delete testing.
 */

import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation, createTestSubGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import {
  plantations,
  subgroups,
  trees,
  species,
  plantationSpecies,
  plantationUsers,
} from '../../src/database/schema';
import { eq, count } from 'drizzle-orm';
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
  // Clear data in full FK order
  await db.delete(trees);
  await db.delete(subgroups);
  await db.delete(plantationSpecies);
  await db.delete(plantationUsers);
  await db.delete(plantations);
  await db.delete(species);
});

/**
 * Replicates the exact deletePlantationLocally logic from PlantationRepository.ts
 * Uses sqlite.transaction() (synchronous) — same atomicity as db.transaction()
 * but compatible with the better-sqlite3 synchronous API.
 */
function deletePlantationLocally(plantacionId: string): void {
  const deleteTrees = sqlite.prepare(
    `DELETE FROM trees WHERE subgrupo_id IN (SELECT id FROM subgroups WHERE plantacion_id = ?)`
  );
  const deleteSubgroups = sqlite.prepare(`DELETE FROM subgroups WHERE plantacion_id = ?`);
  const deletePlantationSpecies = sqlite.prepare(`DELETE FROM plantation_species WHERE plantacion_id = ?`);
  const deletePlantationUsers = sqlite.prepare(`DELETE FROM plantation_users WHERE plantation_id = ?`);
  const deleteUserSpeciesOrder = sqlite.prepare(`DELETE FROM user_species_order WHERE plantacion_id = ?`);
  const deletePlantation = sqlite.prepare(`DELETE FROM plantations WHERE id = ?`);

  const runAll = sqlite.transaction((id: string) => {
    deleteTrees.run(id);
    deleteSubgroups.run(id);
    deletePlantationSpecies.run(id);
    deletePlantationUsers.run(id);
    deleteUserSpeciesOrder.run(id);
    deletePlantation.run(id);
  });

  runAll(plantacionId);
}

describe('Cascade delete', () => {
  test('deletePlantationLocally removes plantation, all subgroups, and all trees', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sp = createTestSpecies({ codigo: 'EUC' });
    await db.insert(species).values(sp);

    const sg1 = createTestSubGroup({ plantacionId: plantation.id, codigo: 'L01', nombre: 'Linea 1' });
    const sg2 = createTestSubGroup({ plantacionId: plantation.id, codigo: 'L02', nombre: 'Linea 2' });
    await db.insert(subgroups).values(sg1);
    await db.insert(subgroups).values(sg2);

    for (let i = 1; i <= 3; i++) {
      await db.insert(trees).values(createTestTree({ subgrupoId: sg1.id, especieId: sp.id, posicion: i, subId: `L01EUC${i}` }));
      await db.insert(trees).values(createTestTree({ subgrupoId: sg2.id, especieId: sp.id, posicion: i, subId: `L02EUC${i}` }));
    }

    deletePlantationLocally(plantation.id);

    const pRows = await db.select().from(plantations).where(eq(plantations.id, plantation.id));
    expect(pRows).toHaveLength(0);

    const sgRows = await db.select().from(subgroups).where(eq(subgroups.plantacionId, plantation.id));
    expect(sgRows).toHaveLength(0);

    const treeRows = await db.select().from(trees);
    expect(treeRows).toHaveLength(0);
  });

  test('deletePlantationLocally removes plantation_species and plantation_users rows', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sp = createTestSpecies({ codigo: 'EUC' });
    await db.insert(species).values(sp);

    // Insert plantation_species
    await db.insert(plantationSpecies).values({
      id: `ps-${plantation.id}-${sp.id}`,
      plantacionId: plantation.id,
      especieId: sp.id,
      ordenVisual: 1,
    });

    // Insert plantation_users
    await db.insert(plantationUsers).values({
      plantationId: plantation.id,
      userId: 'user-tecnico-1',
      rolEnPlantacion: 'tecnico',
      assignedAt: new Date().toISOString(),
    });

    deletePlantationLocally(plantation.id);

    const psRows = await db.select().from(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantation.id));
    expect(psRows).toHaveLength(0);

    const puRows = await db.select().from(plantationUsers).where(eq(plantationUsers.plantationId, plantation.id));
    expect(puRows).toHaveLength(0);

    const pRows = await db.select().from(plantations).where(eq(plantations.id, plantation.id));
    expect(pRows).toHaveLength(0);
  });

  test('after delete, no orphan records remain for any related table', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sp = createTestSpecies({ codigo: 'PIN' });
    await db.insert(species).values(sp);

    const sg = createTestSubGroup({ plantacionId: plantation.id });
    await db.insert(subgroups).values(sg);

    await db.insert(trees).values(createTestTree({ subgrupoId: sg.id, especieId: sp.id, posicion: 1, subId: 'LAPIN1' }));
    await db.insert(plantationSpecies).values({
      id: `ps-${plantation.id}-${sp.id}`,
      plantacionId: plantation.id,
      especieId: sp.id,
      ordenVisual: 1,
    });
    await db.insert(plantationUsers).values({
      plantationId: plantation.id,
      userId: 'user-tecnico-2',
      rolEnPlantacion: 'tecnico',
      assignedAt: new Date().toISOString(),
    });

    deletePlantationLocally(plantation.id);

    // Verify no orphan records in any related table
    const [treeResult] = await db.select({ cnt: count() }).from(trees);
    expect(treeResult.cnt).toBe(0);

    const [sgResult] = await db.select({ cnt: count() }).from(subgroups);
    expect(sgResult.cnt).toBe(0);

    const [psResult] = await db.select({ cnt: count() }).from(plantationSpecies);
    expect(psResult.cnt).toBe(0);

    const [puResult] = await db.select({ cnt: count() }).from(plantationUsers);
    expect(puResult.cnt).toBe(0);

    const [pResult] = await db.select({ cnt: count() }).from(plantations);
    expect(pResult.cnt).toBe(0);
  });

  test('delete of plantation with 0 subgroups succeeds without error', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    // No subgroups inserted
    expect(() => deletePlantationLocally(plantation.id)).not.toThrow();

    const pRows = await db.select().from(plantations).where(eq(plantations.id, plantation.id));
    expect(pRows).toHaveLength(0);
  });
});
