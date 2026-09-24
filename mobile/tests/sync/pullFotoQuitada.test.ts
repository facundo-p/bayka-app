// Pull con foto quitada desde otro dispositivo (#517): contra better-sqlite3 real,
// porque lo que se prueba es el CASE del upsert.
import { createTestDb, closeTestDb, vaciarTablas, IntegrationDb } from '../helpers/integrationDb';
import {
  createTestPlantation,
  createTestGroup,
  createTestParcela,
  createTestTree,
  createTestSpecies,
} from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';
import { fotosQuitadasEnServer, upsertTreesFromServerTx } from '../../src/services/sync/pullService';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';

let db: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

const PID = 'plantation-1';
const SP = 'species-1';
const GROUP = 'group-1';
const FOTO_LOCAL = 'file:///data/fotos/tree-1.jpg';
const FOTO_SERVER = 'plantations/p1/parcelas/pa1/trees/tree-1.jpg';

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
  await db.insert(parcelas).values(createTestParcela({ id: 'parcela-default', plantacionId: PID }));
  await db.insert(groups).values(createTestGroup({ id: GROUP, plantacionId: PID }));
});

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

/** Inserta la fila local y devuelve el mapa que el pull arma con su única lectura. */
async function conFotoLocal(fotoSynced: boolean) {
  await db.insert(trees).values(
    createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP, fotoUrl: FOTO_LOCAL, fotoSynced }),
  );
  return new Map([['tree-1', { especieId: SP, fotoUrl: FOTO_LOCAL, fotoSynced }]]);
}

async function readTree(id: string) {
  const [row] = await db.select().from(trees).where(eq(trees.id, id));
  return row;
}

describe('pull — foto quitada en el server (#517)', () => {
  it('foto ya subida y server sin foto: limpia la referencia local y devuelve el archivo a borrar', async () => {
    const locales = await conFotoLocal(true);
    const remotos = [serverTree({ foto_url: null })];

    const quitadas = fotosQuitadasEnServer(remotos, locales);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(quitadas).toEqual([FOTO_LOCAL]);
    const row = await readTree('tree-1');
    expect(row.fotoUrl).toBeNull();
    expect(row.fotoSynced).toBe(false);
  });

  it('foto pendiente de subir y server sin foto: conserva la copia local', async () => {
    const locales = await conFotoLocal(false);
    const remotos = [serverTree({ foto_url: null })];

    const quitadas = fotosQuitadasEnServer(remotos, locales);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(quitadas).toEqual([]);
    const row = await readTree('tree-1');
    expect(row.fotoUrl).toBe(FOTO_LOCAL);
    expect(row.fotoSynced).toBe(false);
  });

  it('foto ya subida y server con foto: conserva la copia local sin volver a bajarla', async () => {
    const locales = await conFotoLocal(true);
    const remotos = [serverTree({ foto_url: FOTO_SERVER })];

    const quitadas = fotosQuitadasEnServer(remotos, locales);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(quitadas).toEqual([]);
    const row = await readTree('tree-1');
    expect(row.fotoUrl).toBe(FOTO_LOCAL);
    expect(row.fotoSynced).toBe(true);
  });

  it('sin foto local, el server manda la suya', async () => {
    await db.insert(trees).values(createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP }));

    await upsertTreesFromServerTx(db as any, [serverTree({ foto_url: FOTO_SERVER })]);

    const row = await readTree('tree-1');
    expect(row.fotoUrl).toBe(FOTO_SERVER);
    expect(row.fotoSynced).toBe(true);
  });
});
