// Pull con foto quitada (#517) o cambiada (#795) desde otro dispositivo, y GPS
// cambiado en el server: contra better-sqlite3 real, porque lo que se prueba es el
// CASE del upsert.
import { createTestDb, closeTestDb, vaciarTablas, IntegrationDb } from '../helpers/integrationDb';
import {
  createTestPlantation,
  createTestGroup,
  createTestParcela,
  createTestTree,
  createTestSpecies,
} from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';
import { fotosLocalesObsoletas, upsertTreesFromServerTx } from '../../src/services/sync/pullService';
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
async function conFotoLocal(fotoSynced: boolean, fotoBase: string | null = null) {
  await db.insert(trees).values(
    createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP, fotoUrl: FOTO_LOCAL, fotoSynced, fotoBase }),
  );
  return new Map([['tree-1', { fotoUrl: FOTO_LOCAL, fotoSynced, fotoBase }]]);
}

async function readTree(id: string) {
  const [row] = await db.select().from(trees).where(eq(trees.id, id));
  return row;
}

describe('pull — foto quitada en el server (#517)', () => {
  it('foto ya subida y server sin foto: limpia la referencia local y devuelve el archivo a borrar', async () => {
    const locales = await conFotoLocal(true);
    const remotos = [serverTree({ foto_url: null })];

    const quitadas = fotosLocalesObsoletas(remotos, locales);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(quitadas).toEqual([FOTO_LOCAL]);
    const row = await readTree('tree-1');
    expect(row.fotoUrl).toBeNull();
    expect(row.fotoSynced).toBe(false);
  });

  it('foto pendiente de subir y server sin foto: conserva la copia local', async () => {
    const locales = await conFotoLocal(false);
    const remotos = [serverTree({ foto_url: null })];

    const quitadas = fotosLocalesObsoletas(remotos, locales);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(quitadas).toEqual([]);
    const row = await readTree('tree-1');
    expect(row.fotoUrl).toBe(FOTO_LOCAL);
    expect(row.fotoSynced).toBe(false);
  });

  it('foto ya subida y server con foto: conserva la copia local sin volver a bajarla', async () => {
    const locales = await conFotoLocal(true);
    const remotos = [serverTree({ foto_url: FOTO_SERVER })];

    const quitadas = fotosLocalesObsoletas(remotos, locales);
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

describe('pull — foto cambiada en el server (#795)', () => {
  const FOTO_NUEVA = 'plantations/p1/parcelas/pa1/trees/tree-1-photo2.jpg';

  it('copia local de la foto que el server reemplazó: adopta el path nuevo y devuelve el archivo a borrar', async () => {
    const locales = await conFotoLocal(true, FOTO_SERVER);
    const remotos = [serverTree({ foto_url: FOTO_NUEVA })];

    const obsoletas = fotosLocalesObsoletas(remotos, locales);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(obsoletas).toEqual([FOTO_LOCAL]);
    expect(await readTree('tree-1')).toMatchObject({ fotoUrl: FOTO_NUEVA, fotoSynced: true, fotoBase: FOTO_NUEVA });
  });

  it('copia local de la misma foto del server: la conserva', async () => {
    const locales = await conFotoLocal(true, FOTO_SERVER);
    const remotos = [serverTree({ foto_url: FOTO_SERVER })];

    expect(fotosLocalesObsoletas(remotos, locales)).toEqual([]);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(await readTree('tree-1')).toMatchObject({ fotoUrl: FOTO_LOCAL, fotoBase: FOTO_SERVER });
  });

  // Bajada antes de que el teléfono guardara bases: no hay con qué comparar.
  it('copia local sin base: la conserva y toma el path del server como base', async () => {
    const locales = await conFotoLocal(true);
    const remotos = [serverTree({ foto_url: FOTO_NUEVA })];

    expect(fotosLocalesObsoletas(remotos, locales)).toEqual([]);
    await upsertTreesFromServerTx(db as any, remotos);

    expect(await readTree('tree-1')).toMatchObject({ fotoUrl: FOTO_LOCAL, fotoBase: FOTO_NUEVA });
  });
});

describe('pull — GPS cambiado en el server (#795)', () => {
  const PUNTO_LOCAL = { latitude: -34.1, longitude: -58.1, gpsAccuracy: 5, gpsCapturedAt: '2026-10-01T10:00:00' };
  const PUNTO_SERVER = { latitude: -34.2, longitude: -58.2, gps_accuracy: 3, gps_captured_at: '2026-10-02T10:00:00' };
  const BASE_LOCAL = { latitudeBase: -34.1, longitudeBase: -58.1, gpsCapturedAtBase: '2026-10-01T10:00:00' };

  const conPunto = (extra: Record<string, unknown>) =>
    db.insert(trees).values(createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP, ...PUNTO_LOCAL, ...extra }));

  it('sin cambio local desde la base: adopta el punto del server y su base', async () => {
    await conPunto(BASE_LOCAL);

    await upsertTreesFromServerTx(db as any, [serverTree(PUNTO_SERVER)]);

    expect(await readTree('tree-1')).toMatchObject({
      latitude: -34.2, longitude: -58.2, gpsAccuracy: 3, gpsCapturedAt: '2026-10-02T10:00:00',
      latitudeBase: -34.2, longitudeBase: -58.2, gpsCapturedAtBase: '2026-10-02T10:00:00',
    });
  });

  it('con un punto cambiado acá: lo conserva y actualiza la base', async () => {
    await conPunto({ latitudeBase: -34.9, longitudeBase: -58.9, gpsCapturedAtBase: '2026-09-01T10:00:00' });

    await upsertTreesFromServerTx(db as any, [serverTree(PUNTO_SERVER)]);

    expect(await readTree('tree-1')).toMatchObject({ latitude: -34.1, latitudeBase: -34.2 });
  });

  it('sin punto local: adopta el del server', async () => {
    await db.insert(trees).values(createTestTree({ id: 'tree-1', groupId: GROUP, especieId: SP }));

    await upsertTreesFromServerTx(db as any, [serverTree(PUNTO_SERVER)]);

    expect(await readTree('tree-1')).toMatchObject({ latitude: -34.2, latitudeBase: -34.2 });
  });
});
