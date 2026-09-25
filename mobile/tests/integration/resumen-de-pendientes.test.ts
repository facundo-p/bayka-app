/**
 * Integration tests: getResumenDePendientes (#478). Es lo que el aviso de "eliminar
 * del dispositivo" dice que se pierde: grupos, parcelas, fotos y borrados sin subir.
 */
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb, IntegrationDb, vaciarTablas, sembrarEspecieDeTest } from '../helpers/integrationDb';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree } from '../helpers/factories';
import { plantations, parcelas, groups, trees, borradosPendientes } from '../../src/database/schema';

jest.mock('../../src/supabase/client', () => ({ supabase: {} }));

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { getResumenDePendientes, getPlantacionParaEliminarDelDispositivo } from '../../src/queries/catalogQueries';

const PID = 'plant-1';
const OTRA = 'plant-2';

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
    createTestPlantation({ id: PID, lugar: 'Norte' }),
    createTestPlantation({ id: OTRA, lugar: 'Sur' }),
  ]);
});

describe('getResumenDePendientes', () => {
  it('sin nada pendiente, todo en cero', async () => {
    expect(await getResumenDePendientes(PID)).toEqual({
      activaCount: 0, finalizadaCount: 0, parcelas: 0, fotos: 0, borrados: 0, especies: 0, tecnicos: 0,
    });
  });

  it('cuenta grupos, parcelas (con tombstones), fotos locales y borrados de esta plantación', async () => {
    await mockTestDb.insert(parcelas).values([
      { ...createTestParcela({ id: 'parc-1', plantacionId: PID, pendingSync: true }) },
      { ...createTestParcela({ id: 'parc-2', plantacionId: PID, codigo: 'P2', nombre: 'P2', pendingSync: true }), deletedAt: '2026-01-01' },
      { ...createTestParcela({ id: 'parc-3', plantacionId: OTRA, pendingSync: true }) },
    ]);
    await mockTestDb.insert(groups).values([
      { ...createTestGroup({ id: 'g-activo', plantacionId: PID, parcelaId: 'parc-1' }), pendingSync: true },
      { ...createTestGroup({ id: 'g-fin', plantacionId: PID, parcelaId: 'parc-1', codigo: 'LB', nombre: 'B', estado: 'finalizada' }), pendingSync: true },
      { ...createTestGroup({ id: 'g-sync', plantacionId: PID, parcelaId: 'parc-1', codigo: 'LC', nombre: 'C', estado: 'finalizada' }), pendingSync: false },
    ]);
    await mockTestDb.insert(trees).values([
      // Foto local en grupo pendiente: también se pierde.
      createTestTree({ id: 't-1', groupId: 'g-activo', fotoUrl: 'file://a.jpg' }),
      createTestTree({ id: 't-2', groupId: 'g-sync', posicion: 2, subId: 'x2', fotoUrl: 'file://b.jpg' }),
      // Remota: ya está en el server.
      createTestTree({ id: 't-3', groupId: 'g-sync', posicion: 3, subId: 'x3', fotoUrl: 'plantations/p/t.jpg' }),
    ]);
    await mockTestDb.insert(borradosPendientes).values([
      { id: 'arbol-borrado', tipo: 'arbol', grupoId: 'g-sync', plantacionId: PID, borradoEn: '2026-01-01' },
      { id: 'otro', tipo: 'grupo', grupoId: null, plantacionId: OTRA, borradoEn: '2026-01-01' },
    ]);

    expect(await getResumenDePendientes(PID)).toEqual({
      activaCount: 1, finalizadaCount: 1, parcelas: 2, fotos: 2, borrados: 1, especies: 0, tecnicos: 0,
    });
  });
});

describe('getPlantacionParaEliminarDelDispositivo', () => {
  it('trae lugar y la marca de eliminada, o null si no está local', async () => {
    expect(await getPlantacionParaEliminarDelDispositivo(PID)).toEqual({ lugar: 'Norte', eliminadaEnServidorEn: null });
    expect(await getPlantacionParaEliminarDelDispositivo('no-existe')).toBeNull();
  });
});
