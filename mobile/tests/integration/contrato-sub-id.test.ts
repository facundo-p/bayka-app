/**
 * contracts/sub-id.json: cambiar el código de una parcela reescribe el SubID de sus árboles igual
 * que el trigger del server (#735). El armado se prueba en tests/contracts.test.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { conRolCacheado } from '../helpers/rolCacheado';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() { return mockTestDb; },
  get sqlite() { return mockSqliteDeIntegracion; },
}));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));

import { updateParcela } from '../../src/repositories/ParcelaRepository';

type VectorDeReescritura = {
  anterior: string;
  nuevo: string;
  grupo: string;
  especie: string | null;
  posicion: number;
  subIdAntes: string;
  subIdDespues: string;
};

const { cambioDeCodigoDeParcela: vectores } = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../contracts/sub-id.json'), 'utf8'),
) as { cambioDeCodigoDeParcela: VectorDeReescritura[] };

/** Una plantación con una parcela, un grupo y el árbol del vector; devuelve la parcela y el árbol. */
async function sembrar(v: VectorDeReescritura): Promise<{ parcelaId: string; arbolId: string }> {
  const plantacion = createTestPlantation();
  await mockTestDb.insert(plantations).values(plantacion);
  const parcela = createTestParcela({ plantacionId: plantacion.id, nombre: 'Norte', codigo: v.anterior });
  await mockTestDb.insert(parcelas).values({ ...parcela, pendingSync: false });
  const grupo = createTestGroup({ plantacionId: plantacion.id, parcelaId: parcela.id, codigo: v.grupo, nombre: 'Uno' });
  await mockTestDb.insert(groups).values({ ...grupo, pendingSync: false });

  let especieId: string | null = null;
  if (v.especie) {
    const especie = createTestSpecies({ codigo: v.especie });
    await mockTestDb.insert(species).values(especie);
    especieId = especie.id;
  }
  const arbol = createTestTree({ groupId: grupo.id, especieId, posicion: v.posicion, subId: v.subIdAntes });
  await mockTestDb.insert(trees).values(arbol);
  return { parcelaId: parcela.id, arbolId: arbol.id };
}

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  conRolCacheado('admin');
  await vaciarTablas(mockTestDb);
});

describe('contracts · sub-id · cambio de código de parcela', () => {
  it('trae vectores', () => expect(vectores.length).toBeGreaterThan(0));

  it.each(vectores.map((v) => [v.subIdAntes, v.subIdDespues, v] as const))(
    'updateParcela reescribe %s a %s',
    async (_, __, v) => {
      const { parcelaId, arbolId } = await sembrar(v);

      expect(await updateParcela(parcelaId, { nombre: 'Norte', codigo: v.nuevo })).toEqual({ success: true });

      const [arbol] = await mockTestDb.select({ subId: trees.subId }).from(trees).where(eq(trees.id, arbolId));
      expect(arbol.subId).toBe(v.subIdDespues);
    },
  );
});
