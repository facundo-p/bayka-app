/**
 * Integration tests: SubGroup lifecycle
 * Tests: activa -> finalizada -> sincronizada state machine
 * Uses real SQLite via better-sqlite3 + drizzle migrations
 */

import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation, createTestSubGroup } from '../helpers/factories';
import {
  plantations,
  subgroups,
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
  // Clear data in FK order (trees -> subgroups -> plantations)
  await db.delete(subgroups);
  await db.delete(plantations);
});

describe('SubGroup lifecycle', () => {
  test('creates subgroup with estado=activa and persists in DB', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sg = createTestSubGroup({ plantacionId: plantation.id, estado: 'activa' });
    await db.insert(subgroups).values(sg);

    const rows = await db.select().from(subgroups).where(eq(subgroups.id, sg.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].estado).toBe('activa');
    expect(rows[0].plantacionId).toBe(plantation.id);
  });

  test('updates subgroup estado from activa to finalizada', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sg = createTestSubGroup({ plantacionId: plantation.id, estado: 'activa' });
    await db.insert(subgroups).values(sg);

    await db.update(subgroups).set({ estado: 'finalizada' }).where(eq(subgroups.id, sg.id));

    const rows = await db.select().from(subgroups).where(eq(subgroups.id, sg.id));
    expect(rows[0].estado).toBe('finalizada');
  });

  test('updates subgroup estado from finalizada to sincronizada', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sg = createTestSubGroup({ plantacionId: plantation.id, estado: 'finalizada' });
    await db.insert(subgroups).values(sg);

    await db.update(subgroups).set({ estado: 'sincronizada' }).where(eq(subgroups.id, sg.id));

    const rows = await db.select().from(subgroups).where(eq(subgroups.id, sg.id));
    expect(rows[0].estado).toBe('sincronizada');
  });

  test('enforces unique (plantacionId, codigo) constraint — same plantation', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sg1 = createTestSubGroup({ plantacionId: plantation.id, codigo: 'LA', nombre: 'Linea A' });
    await db.insert(subgroups).values(sg1);

    const sg2 = createTestSubGroup({ plantacionId: plantation.id, codigo: 'LA', nombre: 'Linea B' });

    let threw = false;
    try {
      await db.insert(subgroups).values(sg2);
    } catch (e: any) {
      threw = true;
      expect(e.message).toMatch(/UNIQUE constraint failed/);
    }
    expect(threw).toBe(true);

    // Only sg1 exists
    const rows = await db.select().from(subgroups).where(eq(subgroups.plantacionId, plantation.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sg1.id);
  });

  test('allows same codigo in different plantations', async () => {
    const p1 = createTestPlantation({ lugar: 'Campo Norte' });
    const p2 = createTestPlantation({ lugar: 'Campo Sur' });
    await db.insert(plantations).values(p1);
    await db.insert(plantations).values(p2);

    const sg1 = createTestSubGroup({ plantacionId: p1.id, codigo: 'LA', nombre: 'Linea A P1' });
    const sg2 = createTestSubGroup({ plantacionId: p2.id, codigo: 'LA', nombre: 'Linea A P2' });

    await expect(db.insert(subgroups).values(sg1)).resolves.toBeDefined();
    await expect(db.insert(subgroups).values(sg2)).resolves.toBeDefined();

    const rows = await db.select().from(subgroups);
    expect(rows).toHaveLength(2);
  });

  test('subgroup FK references correct plantation', async () => {
    const plantation = createTestPlantation();
    await db.insert(plantations).values(plantation);

    const sg = createTestSubGroup({ plantacionId: plantation.id });
    await db.insert(subgroups).values(sg);

    const rows = await db.select().from(subgroups).where(eq(subgroups.id, sg.id));
    expect(rows[0].plantacionId).toBe(plantation.id);
  });
});
