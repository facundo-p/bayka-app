/**
 * Cambiar el código de una parcela o de un grupo reescribe el SubID de sus árboles (#623).
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { conRolCacheado } from '../helpers/rolCacheado';
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
import { updateGroup } from '../../src/repositories/GroupRepository';
import { errorDeDuplicado } from '../../src/database/sqliteErrors';

let plantacionId: string;
let parcelaId: string;
let grupoIds: string[];

async function sembrar(): Promise<void> {
  const plantacion = createTestPlantation();
  plantacionId = plantacion.id;
  await mockTestDb.insert(plantations).values(plantacion);
  const parcela = createTestParcela({ plantacionId, nombre: 'Norte', codigo: 'P1' });
  const ajena = createTestParcela({ plantacionId, nombre: 'Sur', codigo: 'P2' });
  parcelaId = parcela.id;
  await mockTestDb.insert(parcelas).values([{ ...parcela, pendingSync: false }, ajena]);

  const l1 = createTestGroup({ plantacionId, parcelaId, codigo: 'L1', nombre: 'Uno' });
  const l2 = createTestGroup({ plantacionId, parcelaId, codigo: 'L2', nombre: 'Dos' });
  const ajeno = createTestGroup({ plantacionId, parcelaId: ajena.id, codigo: 'L1', nombre: 'Uno' });
  grupoIds = [l1.id, l2.id];
  await mockTestDb.insert(groups).values([l1, l2, ajeno].map((g) => ({ ...g, pendingSync: false })));

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

async function gruposPendientes(): Promise<boolean[]> {
  const filas = await mockTestDb.select({ id: groups.id, p: groups.pendingSync }).from(groups);
  return grupoIds.map((id) => filas.find((f) => f.id === id)!.p);
}

async function parcelaActual() {
  const [parcela] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, parcelaId));
  return parcela;
}

const finalizarPlantacion = () =>
  mockTestDb.update(plantations).set({ estado: 'finalizada' }).where(eq(plantations.id, plantacionId));

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
  conRolCacheado('admin');
  await vaciarTablas(mockTestDb);
  await sembrar();
});

describe('updateParcela recalcula los SubID', () => {
  it('cambiar el código reescribe el prefijo en todos sus grupos; solo la parcela queda pendiente', async () => {
    const r = await updateParcela(parcelaId, { nombre: 'Norte', codigo: 'p9' });

    expect(r).toEqual({ success: true });
    expect(await subIds()).toEqual({
      a1: 'P9L1EUC1', a2: 'P9L1KOK2', a3: 'P9L1NN3', b1: 'P9L2EUC1', c1: 'P2L1EUC1',
    });
    expect(await parcelaActual()).toMatchObject({ codigo: 'P9', pendingSync: true });
    expect(await gruposPendientes()).toEqual([false, false]);
  });

  it('la especie recuperada conserva su segmento, no cae a NN', async () => {
    await updateParcela(parcelaId, { nombre: 'Norte', codigo: 'P9' });
    await updateParcela(parcelaId, { nombre: 'Norte', codigo: 'P7' });

    expect((await subIds()).a2).toBe('P7L1KOK2');
  });

  it('cambiar solo el nombre no toca los SubID', async () => {
    const r = await updateParcela(parcelaId, { nombre: 'Norte bis', codigo: 'P1' });

    expect(r).toEqual({ success: true });
    expect(await subIds()).toEqual(SUBIDS_ORIGINALES);
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
    expect(await parcelaActual()).toMatchObject({ codigo: 'P1', pendingSync: false });
    expect(await subIds()).toEqual(SUBIDS_ORIGINALES);
  });

  it('con la plantación finalizada no escribe nada', async () => {
    await finalizarPlantacion();

    const r = await updateParcela(parcelaId, { nombre: 'Otro', codigo: 'P9' });

    expect(r).toEqual({ success: false, error: 'plantacion_no_editable' });
    expect(await parcelaActual()).toMatchObject({ nombre: 'Norte', codigo: 'P1', pendingSync: false });
    expect(await subIds()).toEqual(SUBIDS_ORIGINALES);
  });
});

describe('updateGroup', () => {
  it('cambiar el código recalcula los SubID en la misma escritura y conserva la especie recuperada', async () => {
    const [uno] = grupoIds;

    const r = await updateGroup(uno, { nombre: 'Uno', codigo: 'l9', tipo: 'linea' });

    expect(r).toEqual({ success: true });
    expect(await subIds()).toMatchObject({ a1: 'P1L9EUC1', a2: 'P1L9KOK2', a3: 'P1L9NN3', b1: 'P1L2EUC1' });
    expect(await gruposPendientes()).toEqual([true, false]);
  });

  it('con la plantación finalizada no escribe nada', async () => {
    await finalizarPlantacion();

    const r = await updateGroup(grupoIds[0], { nombre: 'Otro', codigo: 'L9', tipo: 'linea' });

    expect(r).toEqual({ success: false, error: 'plantacion_no_editable' });
    const [grupo] = await mockTestDb.select().from(groups).where(eq(groups.id, grupoIds[0]));
    expect(grupo).toMatchObject({ nombre: 'Uno', codigo: 'L1', pendingSync: false });
    expect(await subIds()).toEqual(SUBIDS_ORIGINALES);
  });
});

describe('errorDeDuplicado con el mensaje real de SQLite', () => {
  const chocar = (campos: { nombre: string; codigo: string }) =>
    mockTestDb.insert(parcelas).values(createTestParcela({ plantacionId, ...campos }));

  it('distingue nombre de código', async () => {
    await expect(chocar({ nombre: 'Norte', codigo: 'P5' }).catch(errorDeDuplicado)).resolves.toBe('nombre_duplicate');
    await expect(chocar({ nombre: 'Este', codigo: 'P1' }).catch(errorDeDuplicado)).resolves.toBe('codigo_duplicate');
  });
});
