/**
 * contracts/sub-id.json contra los caminos de la app que escriben un SubID (#735): registrar un
 * árbol, cambiarle la especie y cambiar el código de su parcela. El server recorre los mismos
 * vectores en pgTAP.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { conRolCacheado } from '../helpers/rolCacheado';
import { leerContrato } from '../helpers/contratos';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree, createTestSpecies } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';
import { UNKNOWN_SPECIES_CODE } from '../../src/utils/speciesHelpers';

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() { return mockTestDb; },
  get sqlite() { return mockSqliteDeIntegracion; },
}));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));

import { updateParcela } from '../../src/repositories/ParcelaRepository';
import { insertTree, cambiarEspecie } from '../../src/repositories/TreeRepository';

type VectorDeArmado = { parcela: string; grupo: string; especie: string | null; posicion: number; subId: string };

type VectorDeReescritura = {
  anterior: string;
  nuevo: string;
  grupo: string;
  especie: string | null;
  posicion: number;
  subIdAntes: string;
  subIdDespues: string;
};

const contrato = leerContrato('sub-id.json') as {
  armado: VectorDeArmado[];
  cambioDeCodigoDeParcela: VectorDeReescritura[];
};
const conEspecie = contrato.armado.filter((v) => v.especie !== null);

/** Una plantación con una parcela y un grupo vacío. */
async function sembrarGrupo(parcelaCodigo: string, grupoCodigo: string) {
  const plantacion = createTestPlantation();
  await mockTestDb.insert(plantations).values(plantacion);
  const parcela = createTestParcela({ plantacionId: plantacion.id, nombre: 'Norte', codigo: parcelaCodigo });
  await mockTestDb.insert(parcelas).values({ ...parcela, pendingSync: false });
  const grupo = createTestGroup({ plantacionId: plantacion.id, parcelaId: parcela.id, codigo: grupoCodigo, nombre: 'Uno' });
  await mockTestDb.insert(groups).values({ ...grupo, pendingSync: false });
  return { parcelaId: parcela.id, grupoId: grupo.id };
}

async function sembrarEspecie(codigo: string | null): Promise<string | null> {
  if (codigo === null) return null;
  const especie = createTestSpecies({ codigo });
  await mockTestDb.insert(species).values(especie);
  return especie.id;
}

async function subIdDe(arbolId: string): Promise<string> {
  const [arbol] = await mockTestDb.select({ subId: trees.subId }).from(trees).where(eq(trees.id, arbolId));
  return arbol.subId;
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

describe('contracts · sub-id', () => {
  it('trae vectores con y sin especie, y de cambio de código de parcela', () => {
    expect(conEspecie.length).toBeGreaterThan(0);
    expect(conEspecie.length).toBeLessThan(contrato.armado.length);
    expect(contrato.cambioDeCodigoDeParcela.length).toBeGreaterThan(0);
  });

  // La posición sale de la última del grupo: un árbol previo la deja en la del vector.
  it.each(contrato.armado.map((v) => [v.subId, v] as const))('insertTree arma %s', async (_, v) => {
    const { grupoId } = await sembrarGrupo(v.parcela, v.grupo);
    const especieId = await sembrarEspecie(v.especie);
    if (v.posicion > 1) {
      await mockTestDb.insert(trees).values(createTestTree({ groupId: grupoId, especieId: null, posicion: v.posicion - 1 }));
    }

    const { subId } = await insertTree({
      grupoId, grupoCodigo: v.grupo, especieId, especieCodigo: v.especie ?? UNKNOWN_SPECIES_CODE, userId: 'u1',
    });

    expect(subId).toBe(v.subId);
  });

  it.each(conEspecie.map((v) => [v.subId, v] as const))('cambiarEspecie arma %s', async (_, v) => {
    const { grupoId } = await sembrarGrupo(v.parcela, v.grupo);
    const especieId = (await sembrarEspecie(v.especie))!;
    const arbol = createTestTree({ groupId: grupoId, especieId: null, posicion: v.posicion, subId: 'sin-armar' });
    await mockTestDb.insert(trees).values(arbol);

    expect(await cambiarEspecie(arbol.id, especieId)).toEqual({ subId: v.subId });
    expect(await subIdDe(arbol.id)).toBe(v.subId);
  });

  it.each(contrato.cambioDeCodigoDeParcela.map((v) => [v.subIdAntes, v.subIdDespues, v] as const))(
    'updateParcela reescribe %s a %s',
    async (_, __, v) => {
      const { parcelaId, grupoId } = await sembrarGrupo(v.anterior, v.grupo);
      const especieId = await sembrarEspecie(v.especie);
      const arbol = createTestTree({ groupId: grupoId, especieId, posicion: v.posicion, subId: v.subIdAntes });
      await mockTestDb.insert(trees).values(arbol);

      expect(await updateParcela(parcelaId, { nombre: 'Norte', codigo: v.nuevo })).toEqual({ success: true });
      expect(await subIdDe(arbol.id)).toBe(v.subIdDespues);
    },
  );
});
