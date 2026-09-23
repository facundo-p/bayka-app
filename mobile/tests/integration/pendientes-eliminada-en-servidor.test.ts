/**
 * Integration tests (#518): lo pendiente de una plantación eliminada en el servidor no se
 * puede subir, así que no enciende el punto naranja global, el de la tarjeta ni el
 * "listos para sincronizar".
 */
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb, IntegrationDb, vaciarTablas, sembrarEspecieDeTest } from '../helpers/integrationDb';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree } from '../helpers/factories';
import { plantations, parcelas, groups, trees } from '../../src/database/schema';
import {
  countPendingGroups,
  countPendingParcelas,
  countPendingTreePhotos,
  countPendingGroupsByPlantation,
  countPendingParcelasByPlantation,
  countPendingTreePhotosByPlantation,
} from '../../src/queries/pendingSyncQueries';
import { getPendingSyncCounts } from '../../src/queries/dashboardQueries';

jest.mock('../../src/supabase/client', () => ({ supabase: {} }));

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

const VIGENTE = 'plant-vigente';
const ELIMINADA = 'plant-eliminada';

async function sembrarPendientes(plantacionId: string) {
  const parcelaId = `${plantacionId}-parc`;
  await mockTestDb.insert(parcelas).values(createTestParcela({ id: parcelaId, plantacionId, pendingSync: true }));
  await mockTestDb.insert(groups).values([
    { ...createTestGroup({ id: `${plantacionId}-g-pend`, plantacionId, parcelaId }), pendingSync: true },
    { ...createTestGroup({ id: `${plantacionId}-g-sync`, plantacionId, parcelaId, codigo: 'LB', nombre: 'Linea B' }), pendingSync: false },
  ]);
  await mockTestDb.insert(trees).values(
    createTestTree({ id: `${plantacionId}-t`, groupId: `${plantacionId}-g-sync`, fotoUrl: 'file://foto.jpg' }),
  );
}

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  await sembrarEspecieDeTest(mockTestDb);
  await mockTestDb.insert(plantations).values([
    createTestPlantation({ id: VIGENTE }),
    createTestPlantation({ id: ELIMINADA, eliminadaEnServidorEn: '2026-09-17T12:00:00.000Z' }),
  ]);
  await sembrarPendientes(VIGENTE);
  await sembrarPendientes(ELIMINADA);
});

describe('conteos globales', () => {
  it('no suman lo pendiente de la eliminada', async () => {
    expect(await countPendingGroups({})).toEqual([{ cnt: 1 }]);
    expect(await countPendingParcelas({})).toEqual([{ cnt: 1 }]);
    expect(await countPendingTreePhotos({})).toEqual([{ cnt: 1 }]);
  });

  it('filtrados por la eliminada siguen contando: es el detalle de esa plantación', async () => {
    expect(await countPendingGroups({ plantacionId: ELIMINADA })).toEqual([{ cnt: 1 }]);
    expect(await countPendingParcelas({ plantacionId: ELIMINADA })).toEqual([{ cnt: 1 }]);
    expect(await countPendingTreePhotos({ plantacionId: ELIMINADA })).toEqual([{ cnt: 1 }]);
  });
});

describe('conteos por plantación', () => {
  it('la eliminada no aparece', async () => {
    const vigenteSola = [{ plantacionId: VIGENTE, cnt: 1 }];
    expect(await countPendingGroupsByPlantation()).toEqual(vigenteSola);
    expect(await countPendingParcelasByPlantation()).toEqual(vigenteSola);
    expect(await countPendingTreePhotosByPlantation()).toEqual(vigenteSola);
    expect(await getPendingSyncCounts()).toEqual([{ plantacionId: VIGENTE, pendingCount: 1 }]);
  });
});
