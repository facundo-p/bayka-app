/**
 * Una especie que falta en el catálogo local se recrea al activar las FKs (#616). Su codigo
 * provisorio no puede llegar a un SubID ni ofrecerse para elegir, y el pull del catálogo
 * tiene que convertirla en la especie real.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species, plantationSpecies } from '../../src/database/schema';
import { localNow } from '../../src/utils/dateUtils';

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;
const mockServer: Record<string, any[]> = {};

jest.mock('../../src/database/client', () => ({
  get db() { return mockTestDb; },
  get sqlite() { return mockSqliteDeIntegracion; },
}));

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: (tabla: string) => ({
      select: () => ({
        then: (resolver: any) => Promise.resolve({ data: mockServer[tabla] ?? [], error: null }).then(resolver),
      }),
    }),
  },
}));

jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { limpiarHuerfanos } from '../../src/database/integridadReferencial';
import { insertTree, reverseTreeOrder } from '../../src/repositories/TreeRepository';
import { updateGroupCode } from '../../src/repositories/GroupRepository';
import { getSpeciesForPlantation } from '../../src/repositories/PlantationSpeciesRepository';
import { getAllSpecies } from '../../src/queries/adminQueries';
import { pullSpeciesFromServer } from '../../src/services/sync/catalogoDeEspecies';

const FALTANTE = 'c2222222-2222-2222-2222-222222222222';

let plantacionId: string;
let grupoId: string;
let otroGrupoId: string;

/** Árbol y especie de plantación apuntando a una especie que no está, reparados como en el arranque. */
async function sembrarEspecieFaltante(): Promise<void> {
  sqlite.pragma('foreign_keys = OFF');
  await mockTestDb.insert(trees).values([
    createTestTree({ id: 't1', groupId: grupoId, especieId: FALTANTE, posicion: 1, subId: 'P1L1KOK1' }),
    createTestTree({ id: 't-raro', groupId: otroGrupoId, especieId: FALTANTE, posicion: 1, subId: 'X' }),
  ]);
  await mockTestDb.insert(plantationSpecies).values({
    id: 'ps-faltante', plantacionId, especieId: FALTANTE, ordenVisual: 1,
  });
  limpiarHuerfanos({
    execSync: (sql) => { sqlite.exec(sql); },
    getAllSync: <T,>(sql: string, params: (string | number | null)[]) => sqlite.prepare(sql).all(...params) as T[],
    runSync: (sql, params) => sqlite.prepare(sql).run(...params),
  });
  sqlite.pragma('foreign_keys = ON');
}

const subIdDe = async (id: string) =>
  (await mockTestDb.select({ subId: trees.subId }).from(trees).where(eq(trees.id, id)))[0].subId;

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  for (const tabla of Object.keys(mockServer)) delete mockServer[tabla];

  const plantacion = createTestPlantation();
  plantacionId = plantacion.id;
  await mockTestDb.insert(plantations).values(plantacion);
  const parcela = createTestParcela({ plantacionId, codigo: 'P1' });
  await mockTestDb.insert(parcelas).values(parcela);
  const grupo = createTestGroup({ plantacionId, parcelaId: parcela.id, codigo: 'L1' });
  grupoId = grupo.id;
  const otro = createTestGroup({ plantacionId, parcelaId: parcela.id, codigo: 'L2', nombre: 'Otro' });
  otroGrupoId = otro.id;
  await mockTestDb.insert(groups).values([grupo, otro]);
  const euc = createTestSpecies({ codigo: 'EUC' });
  await mockTestDb.insert(species).values(euc);
  await mockTestDb.insert(plantationSpecies).values({ id: 'ps-euc', plantacionId, especieId: euc.id, ordenVisual: 0 });

  await sembrarEspecieFaltante();
});

describe('especie recuperada', () => {
  it('registrar sobre ella escribe NN en el SubID', async () => {
    const [recuperada] = await mockTestDb.select().from(species).where(eq(species.id, FALTANTE));
    const { subId } = await insertTree({
      grupoId, grupoCodigo: 'L1', especieId: FALTANTE, especieCodigo: recuperada.codigo, userId: 'u1',
    });
    expect(subId).toBe('P1L1NN2');
  });

  it('renumerar y renombrar el grupo conservan el codigo que ya tenía el SubID', async () => {
    await insertTree({ grupoId, grupoCodigo: 'L1', especieId: null, especieCodigo: 'NN', userId: 'u1' });

    await reverseTreeOrder(grupoId, 'L1');
    expect(await subIdDe('t1')).toBe('P1L1KOK2');

    await updateGroupCode(grupoId, 'L9', 'L1');
    expect(await subIdDe('t1')).toBe('P1L9KOK2');
  });

  it('si el SubID no deja leer el codigo, recalcularlo escribe NN', async () => {
    await updateGroupCode(otroGrupoId, 'L3', 'L2');
    expect(await subIdDe('t-raro')).toBe('P1L3NN1');
  });

  it('no se ofrece en los botones de registro ni en el catálogo del admin', async () => {
    const botones = await getSpeciesForPlantation(plantacionId);
    expect(botones.map((b) => b.codigo)).toEqual(['EUC']);
    expect((await getAllSpecies()).map((e) => e.codigo)).toEqual(['EUC']);
  });

  it('el pull del catálogo la convierte en la especie real', async () => {
    mockServer.species = [{ id: FALTANTE, codigo: 'KOK', nombre: 'Kokú', nombre_cientifico: null, created_at: localNow() }];

    await pullSpeciesFromServer();

    const [real] = await mockTestDb.select().from(species).where(eq(species.id, FALTANTE));
    expect(real).toMatchObject({ codigo: 'KOK', nombre: 'Kokú' });
    const botones = await getSpeciesForPlantation(plantacionId);
    expect(botones.map((b) => b.codigo).sort()).toEqual(['EUC', 'KOK']);
    await reverseTreeOrder(grupoId, 'L1');
    expect(await subIdDe('t1')).toBe('P1L1KOK1');
  });
});
