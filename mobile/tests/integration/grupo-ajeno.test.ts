/**
 * Integration tests (#768): en un grupo ajeno editan solo admin y superadmin, y lo
 * pendiente cuenta para quien lo va a subir.
 */
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb, IntegrationDb, vaciarTablas, sembrarEspecieDeTest } from '../helpers/integrationDb';
import { createTestPlantation, createTestParcela, createTestGroup, createTestTree } from '../helpers/factories';
import { conRolCacheado } from '../helpers/rolCacheado';
import { plantations, parcelas, groups, trees } from '../../src/database/schema';
import { ESTADO_GRUPO, ESTADO_PLANTACION } from '../../src/constants/estados';
import { puedeEditarArbolesDe } from '../../src/repositories/edicionDeArboles';
import {
  countPendingGroups,
  countNNBlockedGroups,
  countPendingTreePhotos,
  countPendingGroupsByPlantation,
  countPendingTreePhotosByPlantation,
} from '../../src/queries/pendingSyncQueries';

jest.mock('../../src/supabase/client', () => ({ supabase: {} }));

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

const PLANT = 'plant-1';
const PARCELA = 'parc-1';
const CREADOR = 'user-tecnico-1';
const OTRO_TECNICO = 'user-tecnico-2';
const ADMIN = 'user-admin-1';
const GRUPO = 'g-del-creador';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  await sembrarEspecieDeTest(mockTestDb);
  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANT }));
  await mockTestDb.insert(parcelas).values(createTestParcela({ id: PARCELA, plantacionId: PLANT }));
  await mockTestDb.insert(groups).values(
    createTestGroup({ id: GRUPO, plantacionId: PLANT, parcelaId: PARCELA, usuarioCreador: CREADOR }),
  );
});

describe('puedeEditarArbolesDe', () => {
  it.each([
    ['el técnico creador', true, 'tecnico', CREADOR],
    ['otro técnico', false, 'tecnico', OTRO_TECNICO],
    ['un admin', true, 'admin', ADMIN],
    ['un superadmin', true, 'superadmin', ADMIN],
    ['un técnico sin userId cacheado', false, 'tecnico', null],
  ])('%s puede editar: %p', async (_quien, esperado, rol, userId) => {
    conRolCacheado(rol, userId);
    expect(await puedeEditarArbolesDe(GRUPO)).toBe(esperado);
  });

  it('un grupo que no está local no se edita', async () => {
    conRolCacheado('admin', ADMIN);
    expect(await puedeEditarArbolesDe('g-inexistente')).toBe(false);
  });

  it('en una plantación finalizada no edita ni el admin', async () => {
    await mockTestDb.update(plantations).set({ estado: ESTADO_PLANTACION.finalizada });
    conRolCacheado('admin', ADMIN);
    expect(await puedeEditarArbolesDe(GRUPO)).toBe(false);
  });
});

describe('conteos de pendientes según quién sube', () => {
  async function sembrarPendientesDelCreador() {
    await mockTestDb.insert(groups).values({
      ...createTestGroup({
        id: 'g-pendiente', plantacionId: PLANT, parcelaId: PARCELA, usuarioCreador: CREADOR, codigo: 'LC', nombre: 'Linea C',
      }),
      pendingSync: true,
    });
    await mockTestDb.insert(trees).values(createTestTree({ groupId: GRUPO, fotoUrl: 'file://foto.jpg' }));
  }

  beforeEach(sembrarPendientesDelCreador);

  it('al creador le cuentan su grupo y su foto', async () => {
    const quien = { plantacionId: PLANT, userId: CREADOR, esAdmin: false };
    expect(await countPendingGroups(quien)).toEqual([{ cnt: 1 }]);
    expect(await countPendingTreePhotos(quien)).toEqual([{ cnt: 1 }]);
  });

  it('a otro técnico no le cuentan lo ajeno, que su sync no sube', async () => {
    const quien = { plantacionId: PLANT, userId: OTRO_TECNICO, esAdmin: false };
    expect(await countPendingGroups(quien)).toEqual([{ cnt: 0 }]);
    expect(await countPendingTreePhotos(quien)).toEqual([{ cnt: 0 }]);
    expect(await countPendingGroupsByPlantation(quien)).toEqual([]);
    expect(await countPendingTreePhotosByPlantation(quien)).toEqual([]);
  });

  it('a un admin le cuenta lo ajeno, que su sync sube', async () => {
    const quien = { plantacionId: PLANT, userId: ADMIN, esAdmin: true };
    expect(await countPendingGroups(quien)).toEqual([{ cnt: 1 }]);
    expect(await countPendingTreePhotos(quien)).toEqual([{ cnt: 1 }]);
    expect(await countPendingGroupsByPlantation(quien)).toEqual([{ plantacionId: PLANT, cnt: 1 }]);
    expect(await countPendingTreePhotosByPlantation(quien)).toEqual([{ plantacionId: PLANT, cnt: 1 }]);
  });

  it('un N/N de un grupo ajeno bloquea al admin, no a otro técnico', async () => {
    await mockTestDb.update(groups).set({ estado: ESTADO_GRUPO.finalizada });
    await mockTestDb.insert(trees).values(createTestTree({ groupId: GRUPO, especieId: null, posicion: 2, subId: 'LA-NN-2' }));
    expect(await countNNBlockedGroups({ plantacionId: PLANT, userId: ADMIN, esAdmin: true })).toEqual([{ cnt: 1 }]);
    expect(await countNNBlockedGroups({ plantacionId: PLANT, userId: OTRO_TECNICO, esAdmin: false })).toEqual([{ cnt: 0 }]);
  });
});
