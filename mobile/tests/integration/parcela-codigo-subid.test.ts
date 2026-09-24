/**
 * Cambiar el código de una parcela reescribe el SubID de los árboles de sus grupos (#623).
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';
import * as idGenerator from '../../src/utils/idGenerator';

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() { return mockTestDb; },
  get sqlite() { return mockSqliteDeIntegracion; },
}));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));

import { updateParcela } from '../../src/repositories/ParcelaRepository';

let parcelaId: string;
let grupoIds: string[];
let grupoAjenoId: string;

async function sembrar(): Promise<void> {
  const plantacion = createTestPlantation();
  await mockTestDb.insert(plantations).values(plantacion);
  const parcela = createTestParcela({ plantacionId: plantacion.id, nombre: 'Norte', codigo: 'P1' });
  const ajena = createTestParcela({ plantacionId: plantacion.id, nombre: 'Sur', codigo: 'P2' });
  parcelaId = parcela.id;
  await mockTestDb.insert(parcelas).values([parcela, ajena]);

  const base = { plantacionId: plantacion.id, pendingSync: false };
  const l1 = createTestGroup({ ...base, parcelaId, codigo: 'L1', nombre: 'Uno' });
  const l2 = createTestGroup({ ...base, parcelaId, codigo: 'L2', nombre: 'Dos' });
  const ajeno = createTestGroup({ ...base, parcelaId: ajena.id, codigo: 'L1', nombre: 'Uno' });
  grupoIds = [l1.id, l2.id];
  grupoAjenoId = ajeno.id;
  await mockTestDb.insert(groups).values([l1, l2, ajeno]);

  const euc = createTestSpecies({ id: 'sp-euc', codigo: 'EUC' });
  const recuperada = createTestSpecies({ id: 'sp-kok', codigo: 'recuperada:sp-kok' });
  await mockTestDb.insert(species).values([euc, recuperada]);
  await mockTestDb.insert(trees).values([
    createTestTree({ id: 'a1', groupId: l1.id, especieId: euc.id, posicion: 1, subId: 'P1L1EUC1' }),
    createTestTree({ id: 'a2', groupId: l1.id, especieId: recuperada.id, posicion: 2, subId: 'P1L1KOK2' }),
    createTestTree({ id: 'a3', groupId: l1.id, especieId: null, posicion: 3, subId: 'P1L1NN3' }),
    createTestTree({ id: 'b1', groupId: l2.id, especieId: euc.id, posicion: 1, subId: 'P1L2EUC1' }),
    createTestTree({ id: 'c1', groupId: ajeno.id, especieId: euc.id, posicion: 1, subId: 'P2L1EUC1' }),
  ]);
}

async function subIds(): Promise<Record<string, string>> {
  const filas = await mockTestDb.select({ id: trees.id, subId: trees.subId }).from(trees);
  return Object.fromEntries(filas.map((f) => [f.id, f.subId]));
}

async function pendingSyncDe(grupoId: string): Promise<boolean> {
  const [g] = await mockTestDb.select({ p: groups.pendingSync }).from(groups).where(eq(groups.id, grupoId));
  return g.p;
}

const SUBIDS_ORIGINALES = { a1: 'P1L1EUC1', a2: 'P1L1KOK2', a3: 'P1L1NN3', b1: 'P1L2EUC1', c1: 'P2L1EUC1' };

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  jest.restoreAllMocks();
  await vaciarTablas(mockTestDb);
  await sembrar();
});

describe('updateParcela recalcula los SubID', () => {
  it('cambiar el código reescribe el prefijo en todos sus grupos y los marca pendientes', async () => {
    const r = await updateParcela(parcelaId, { nombre: 'Norte', codigo: 'p9' });

    expect(r).toEqual({ success: true });
    expect(await subIds()).toEqual({
      a1: 'P9L1EUC1', a2: 'P9L1KOK2', a3: 'P9L1NN3', b1: 'P9L2EUC1', c1: 'P2L1EUC1',
    });
    for (const id of grupoIds) expect(await pendingSyncDe(id)).toBe(true);
    expect(await pendingSyncDe(grupoAjenoId)).toBe(false);
  });

  it('la especie recuperada conserva su segmento, no cae a NN', async () => {
    await updateParcela(parcelaId, { nombre: 'Norte', codigo: 'P9' });
    await updateParcela(parcelaId, { nombre: 'Norte', codigo: 'P7' });

    expect((await subIds()).a2).toBe('P7L1KOK2');
  });

  it('cambiar solo el nombre no toca los SubID ni los grupos', async () => {
    const r = await updateParcela(parcelaId, { nombre: 'Norte bis', codigo: 'P1' });

    expect(r).toEqual({ success: true });
    expect(await subIds()).toEqual(SUBIDS_ORIGINALES);
    for (const id of grupoIds) expect(await pendingSyncDe(id)).toBe(false);
  });

  it('un error a mitad del recálculo revierte todo', async () => {
    const real = idGenerator.generateSubId;
    let llamadas = 0;
    jest.spyOn(idGenerator, 'generateSubId').mockImplementation((...args) => {
      if (++llamadas === 3) throw new Error('falla simulada');
      return real(...args);
    });

    const r = await updateParcela(parcelaId, { nombre: 'Norte', codigo: 'P9' });

    expect(r).toEqual({ success: false, error: 'unknown' });
    const [parcela] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, parcelaId));
    expect(parcela.codigo).toBe('P1');
    expect(await subIds()).toEqual(SUBIDS_ORIGINALES);
    for (const id of grupoIds) expect(await pendingSyncDe(id)).toBe(false);
  });
});
