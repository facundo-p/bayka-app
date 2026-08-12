// Integration test: pull preserves/adopts plantacion_id & global_id (Issue #55)
// Runs against real better-sqlite3 + drizzle migrations (the unit pull suites are
// describe.skip pending v1.1 cleanup, so this exercises the production upsert SQL).

import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import {
  createTestPlantation,
  createTestGroup,
  createTestParcela,
  createTestTree,
  createTestSpecies,
} from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';
import { upsertTreeFromServerTx } from '../../src/services/sync/pullService';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';

let db: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

const PID = 'plantation-1';
const SP = 'species-1';
const GROUP = 'group-1';

beforeAll(() => {
  const result = createTestDb();
  db = result.db;
  sqlite = result.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await db.delete(trees);
  await db.delete(groups);
  await db.delete(parcelas);
  await db.delete(plantations);
  await db.delete(species);

  await db.insert(plantations).values(createTestPlantation({ id: PID }));
  await db.insert(species).values(createTestSpecies({ id: SP, codigo: 'EUC' }));
  // #90: parcela obligatoria — el grupo referencia una parcela real.
  await db.insert(parcelas).values(createTestParcela({ id: 'parcela-default', plantacionId: PID }));
  await db.insert(groups).values(createTestGroup({ id: GROUP, plantacionId: PID }));
});

// Server row shape uses snake_case (as returned by supabase.from('trees')).
const serverTree = (overrides: Record<string, any>) => ({
  id: 'tree-1',
  group_id: GROUP,
  species_id: SP,
  posicion: 1,
  sub_id: 'EUC-1',
  foto_url: null,
  usuario_registro: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  plantacion_id: null,
  global_id: null,
  ...overrides,
});

async function readTree(id: string) {
  const [row] = await db.select().from(trees).where(eq(trees.id, id));
  return row;
}

describe('pull — generated ID preservation (Issue #55)', () => {
  it('preserves locally-generated IDs when the server still has none', async () => {
    // Local tree already has IDs generated at finalization, not yet pushed.
    await db.insert(trees).values(
      createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP, plantacionId: 2, globalId: 5 }),
    );

    await upsertTreeFromServerTx(db as any, serverTree({ plantacion_id: null, global_id: null }));

    const row = await readTree('tree-1');
    expect(row.plantacionId).toBe(2);
    expect(row.globalId).toBe(5);
  });

  it('adopts server IDs when the local row has none', async () => {
    // Second device pulled the tree earlier with null IDs; server now has them.
    await db.insert(trees).values(
      createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP, plantacionId: null, globalId: null }),
    );

    await upsertTreeFromServerTx(db as any, serverTree({ plantacion_id: 3, global_id: 10 }));

    const row = await readTree('tree-1');
    expect(row.plantacionId).toBe(3);
    expect(row.globalId).toBe(10);
  });

  it('inserts a brand-new tree with the server IDs', async () => {
    await upsertTreeFromServerTx(db as any, serverTree({ plantacion_id: 7, global_id: 42 }));

    const row = await readTree('tree-1');
    expect(row.plantacionId).toBe(7);
    expect(row.globalId).toBe(42);
  });
});
