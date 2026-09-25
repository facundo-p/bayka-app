/**
 * Integration tests: pullSpeciesFromServer — reconciliación de especies.
 * El server puede traer una especie con `id` distinto al de una fila local
 * que ya usa ese `codigo` (catálogo embebido con id sintético vs. UUID del
 * server); el upsert por id chocaba contra UNIQUE(codigo) y los árboles que
 * apuntaban al id del server quedaban huérfanos. Se reconcilia re-apuntando
 * las referencias al id del server y eliminando la fila duplicada,
 * preservando el codigo para que los SubID sigan válidos.
 */
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import {
  createTestPlantation,
  createTestParcela,
  createTestGroup,
  createTestTree,
} from '../helpers/factories';
import {
  species,
  trees,
  plantations,
  parcelas,
  groups,
  plantationSpecies,
  userSpeciesOrder,
} from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import { localNow } from '../../src/utils/dateUtils';
import Database from 'better-sqlite3';

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

// Filas que "devuelve el server", por tabla — mutable por test.
const mockServer: Record<string, any[]> = {};

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
  // `enTransaccion` abre la transacción por acá: sin esto el test correría sin
  // transacción y no probaría la atomicidad que dice probar (#448).
  get sqlite() {
    return mockSqliteDeIntegracion;
  },
}));

jest.mock('../../src/supabase/client', () => {
  const builder = (tabla: string) => {
    const filtros: { col: string; valores: any[] }[] = [];
    const filas = () => (mockServer[tabla] ?? []).filter((f) => filtros.every((c) => c.valores.includes(f[c.col])));
    const api: any = {
      select() { return api; },
      eq(col: string, valor: any) { filtros.push({ col, valores: [valor] }); return api; },
      in(col: string, valores: any[]) { filtros.push({ col, valores }); return api; },
      single() { return Promise.resolve({ data: filas()[0] ?? null, error: filas()[0] ? null : { code: 'PGRST116' } }); },
      then(resolver: any) { return Promise.resolve({ data: filas(), error: null }).then(resolver); },
    };
    return api;
  };
  return {
    supabase: {
      from: (tabla: string) => builder(tabla),
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
      rpc: (_fn: string, args: { p_ids: string[] }) =>
        Promise.resolve({ data: args.p_ids.map((id) => ({ id, estado: 'ok' })), error: null }),
    },
  };
});

jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { pullSpeciesFromServer } from '../../src/services/sync/catalogoDeEspecies';
import { pullFromServer } from '../../src/services/sync/pullService';
import { conUsuarioCacheado } from '../helpers/rolCacheado';

// El guard de sesión exige que el usuario cacheado sea el de la sesión (#658).
beforeEach(() => conUsuarioCacheado('user-1'));

const LOCAL_ID = 'a0000000-0000-0000-0000-000000000012';
const SERVER_ID = 'b1111111-1111-1111-1111-111111111111';

const especieDelServer = (id: string, codigo: string) => ({
  id, codigo, nombre: 'Kokú', nombre_cientifico: null, created_at: localNow(),
});

const insertarEspecie = (id: string, codigo: string) =>
  mockTestDb.insert(species).values({ id, codigo, nombre: 'Kokú', nombreCientifico: null, createdAt: localNow() });

async function crearPlantacionConGrupo() {
  const plantation = createTestPlantation();
  await mockTestDb.insert(plantations).values(plantation);
  const parcela = createTestParcela({ plantacionId: plantation.id });
  await mockTestDb.insert(parcelas).values(parcela);
  const group = createTestGroup({ plantacionId: plantation.id, parcelaId: parcela.id });
  await mockTestDb.insert(groups).values(group);
  return { plantation, group };
}

const especiesDePlantacion = (plantacionId: string) =>
  mockTestDb.select().from(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  for (const tabla of Object.keys(mockServer)) delete mockServer[tabla];
});

describe('pullSpeciesFromServer — reconciliación por codigo', () => {
  it('re-apunta árbol + plantation_species y elimina la especie local duplicada', async () => {
    const { plantation, group } = await crearPlantacionConGrupo();
    await insertarEspecie(LOCAL_ID, 'COC');

    // Un árbol apuntando al id del server no puede existir antes de reconciliar:
    // las FKs lo rechazan (#617). Los dos apuntan al id local.
    await mockTestDb.insert(trees).values([
      createTestTree({ id: 't1', groupId: group.id, especieId: LOCAL_ID, subId: 'LACOC1', globalId: 6001 }),
      {
        ...createTestTree({ id: 't2', groupId: group.id, especieId: LOCAL_ID, subId: 'LACOC2', globalId: 6002 }),
        conflictEspecieId: LOCAL_ID,
      },
    ]);
    await mockTestDb.insert(plantationSpecies).values({
      id: `ps-${plantation.id}-${LOCAL_ID}`, plantacionId: plantation.id, especieId: LOCAL_ID, ordenVisual: 0,
    });
    await mockTestDb.insert(userSpeciesOrder).values({
      userId: 'u1', plantacionId: plantation.id, especieId: LOCAL_ID, ordenVisual: 3,
    });

    mockServer.species = [especieDelServer(SERVER_ID, 'COC')];

    await pullSpeciesFromServer();

    // El duplicado local desaparece; sobrevive la fila del server con su codigo.
    const byCodigo = await mockTestDb.select().from(species).where(eq(species.codigo, 'COC'));
    expect(byCodigo).toHaveLength(1);
    expect(byCodigo[0].id).toBe(SERVER_ID);
    const oldRow = await mockTestDb.select().from(species).where(eq(species.id, LOCAL_ID));
    expect(oldRow).toHaveLength(0);

    // Ambos árboles resuelven al server id (clave del bug de export).
    const treeRows = await mockTestDb.select().from(trees);
    expect(treeRows.every((t) => t.especieId === SERVER_ID)).toBe(true);
    expect(treeRows.find((t) => t.id === 't2')?.conflictEspecieId).toBe(SERVER_ID);

    // plantation_species re-apuntado, con el id que después usa el pull.
    const ps = await especiesDePlantacion(plantation.id);
    expect(ps).toHaveLength(1);
    expect(ps[0].id).toBe(`ps-${plantation.id}-${SERVER_ID}`);
    expect(ps[0].especieId).toBe(SERVER_ID);

    // user_species_order del id viejo se borró (orden cosmético).
    const uso = await mockTestDb.select().from(userSpeciesOrder);
    expect(uso).toHaveLength(0);
  });

  it('el pull de plantation_species posterior no duplica la especie re-apuntada', async () => {
    const { plantation } = await crearPlantacionConGrupo();
    await insertarEspecie(LOCAL_ID, 'COC');
    await mockTestDb.insert(plantationSpecies).values({
      id: `ps-${plantation.id}-${LOCAL_ID}`, plantacionId: plantation.id, especieId: LOCAL_ID, ordenVisual: 0,
    });
    mockServer.species = [especieDelServer(SERVER_ID, 'COC')];
    mockServer.plantation_species = [{ plantation_id: plantation.id, species_id: SERVER_ID, orden_visual: 4 }];

    await pullSpeciesFromServer();
    await pullFromServer(plantation.id);

    const ps = await especiesDePlantacion(plantation.id);
    expect(ps).toHaveLength(1);
    expect(ps[0].especieId).toBe(SERVER_ID);
    expect(ps[0].ordenVisual).toBe(4);
  });

  it('una plantación que ya tenía la especie del server queda con una sola fila', async () => {
    // La especie del server ya estaba en local con otro codigo; el server se lo
    // cambió al del duplicado local.
    const { plantation } = await crearPlantacionConGrupo();
    await insertarEspecie(SERVER_ID, 'VIEJO');
    await insertarEspecie(LOCAL_ID, 'COC');
    await mockTestDb.insert(plantationSpecies).values([
      { id: `ps-${plantation.id}-${SERVER_ID}`, plantacionId: plantation.id, especieId: SERVER_ID, ordenVisual: 1 },
      { id: `ps-${plantation.id}-${LOCAL_ID}`, plantacionId: plantation.id, especieId: LOCAL_ID, ordenVisual: 2 },
    ]);
    mockServer.species = [especieDelServer(SERVER_ID, 'COC')];

    await pullSpeciesFromServer();

    const ps = await especiesDePlantacion(plantation.id);
    expect(ps).toHaveLength(1);
    expect(ps[0].id).toBe(`ps-${plantation.id}-${SERVER_ID}`);
    const [especie] = await mockTestDb.select().from(species).where(eq(species.id, SERVER_ID));
    expect(especie.codigo).toBe('COC');
  });

  it('si un paso posterior al renombre falla, la transacción deja todo como estaba', async () => {
    const { group } = await crearPlantacionConGrupo();
    await insertarEspecie(LOCAL_ID, 'COC');
    await mockTestDb.insert(trees).values(
      createTestTree({ id: 't1', groupId: group.id, especieId: LOCAL_ID, subId: 'LACOC1', globalId: 6001 }),
    );
    mockServer.species = [especieDelServer(SERVER_ID, 'COC')];
    // Hace fallar el último paso: el borrado de la especie duplicada.
    sqlite.exec(`CREATE TRIGGER falla_borrado BEFORE DELETE ON species
      WHEN old.id = '${LOCAL_ID}' BEGIN SELECT RAISE(ABORT, 'falla simulada'); END`);

    try {
      await pullSpeciesFromServer();
    } finally {
      sqlite.exec('DROP TRIGGER falla_borrado');
    }

    const [local] = await mockTestDb.select().from(species).where(eq(species.id, LOCAL_ID));
    expect(local.codigo).toBe('COC');
    const [arbol] = await mockTestDb.select().from(trees).where(eq(trees.id, 't1'));
    expect(arbol.especieId).toBe(LOCAL_ID);
    expect(await mockTestDb.select().from(species).where(eq(species.id, SERVER_ID))).toHaveLength(0);
  });

  it('inserta una especie nueva con codigo único sin tocar el resto', async () => {
    mockServer.species = [
      { id: 'c-new', codigo: 'YVY', nombre: 'Yvyra', nombre_cientifico: null, created_at: localNow() },
    ];

    await pullSpeciesFromServer();

    const [row] = await mockTestDb.select().from(species).where(eq(species.codigo, 'YVY'));
    expect(row.id).toBe('c-new');
    expect(row.nombre).toBe('Yvyra');
  });

  it('actualiza por id (mismo id, sin reconciliar) cuando no hay colisión', async () => {
    await mockTestDb.insert(species).values({
      id: 'same-id', codigo: 'COC', nombre: 'Kokú viejo', nombreCientifico: null, createdAt: localNow(),
    });
    mockServer.species = [
      { id: 'same-id', codigo: 'COC', nombre: 'Kokú nuevo', nombre_cientifico: 'Coccoloba', created_at: localNow() },
    ];

    await pullSpeciesFromServer();

    const rows = await mockTestDb.select().from(species).where(eq(species.codigo, 'COC'));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('same-id');
    expect(rows[0].nombre).toBe('Kokú nuevo');
    expect(rows[0].nombreCientifico).toBe('Coccoloba');
  });
});
