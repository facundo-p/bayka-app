// El server sigue mandando plantacion_id y global_id en el pull hasta que se
// dropeen (#822): el upsert de árboles los ignora. Corre contra better-sqlite3 con
// las migraciones reales, así ejercita el SQL de producción.

import { createTestDb, closeTestDb, vaciarTablas, IntegrationDb } from '../helpers/integrationDb';
import {
  createTestPlantation,
  createTestGroup,
  createTestParcela,
  createTestTree,
  createTestSpecies,
} from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';
import { upsertTreesFromServerTx } from '../../src/services/sync/pullService';
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
  await vaciarTablas(db);

  await db.insert(plantations).values(createTestPlantation({ id: PID }));
  await db.insert(species).values(createTestSpecies({ id: SP, codigo: 'EUC' }));
  // #90: parcela obligatoria — el grupo referencia una parcela real.
  await db.insert(parcelas).values(createTestParcela({ id: 'parcela-default', plantacionId: PID }));
  await db.insert(groups).values(createTestGroup({ id: GROUP, plantacionId: PID }));
});

// Fila del server tal como la devuelve `select('*')` sobre trees.
const serverTree = (overrides: Record<string, unknown> = {}) => ({
  id: 'tree-1',
  group_id: GROUP,
  species_id: SP,
  posicion: 1,
  sub_id: 'EUC-1',
  foto_url: null,
  usuario_registro: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  plantacion_id: 7,
  global_id: 42,
  ...overrides,
});

async function readTree(id: string) {
  const [row] = await db.select().from(trees).where(eq(trees.id, id));
  return row;
}

function columnasDeTrees(): string[] {
  return (sqlite.prepare('PRAGMA table_info(trees)').all() as { name: string }[]).map((c) => c.name);
}

describe('pull — IDs numéricos del server (#822)', () => {
  it('la tabla local ya no tiene las columnas', () => {
    expect(columnasDeTrees()).not.toContain('plantacion_id');
    expect(columnasDeTrees()).not.toContain('global_id');
  });

  it('inserta un árbol nuevo que trae IDs numéricos', async () => {
    await upsertTreesFromServerTx(db as any, [serverTree()]);

    expect(await readTree('tree-1')).toMatchObject({ id: 'tree-1', subId: 'EUC-1', posicion: 1 });
  });

  it('actualiza un árbol existente que trae IDs numéricos', async () => {
    await db.insert(trees).values(createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP }));

    await upsertTreesFromServerTx(db as any, [serverTree({ posicion: 9 })]);

    expect(await readTree('tree-1')).toMatchObject({ posicion: 9 });
  });
});
