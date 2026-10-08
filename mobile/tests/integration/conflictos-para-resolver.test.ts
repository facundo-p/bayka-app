/**
 * Integration tests (#804): qué conflictos de sincronización muestra "Resolver cambios"
 * y por qué no se puede conservar lo propio en cada caso borde.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestParcela, createTestPlantation } from '../helpers/factories';
import { conRolCacheado } from '../helpers/rolCacheado';
import {
  conflictosDeSync, groups, plantations, parcelas, plantationSpecies, species, trees,
} from '../../src/database/schema';

jest.mock('../../src/supabase/client', () => ({ supabase: {} }));

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/services/PhotoService', () => ({ borrarFotosLocales: jest.fn() }));

import { conflictosParaResolver, resolverConflictosDeSync } from '../../src/services/ConflictosParaResolverService';
import { conflictosDeSyncPorPlantacion, conflictosDeSyncDeGrupo } from '../../src/queries/conflictosDeSyncQueries';

const PLANTACION = 'p-1';
const PARCELA = 'x-1';
const GRUPO = 'g-1';
const TECNICO = 'user-tecnico-1';
const ROBLE = 'sp-roble';
const PINO = 'sp-pino';
const CREADO = '2026-01-01T00:00:00';
const MI_PUNTO = { latitude: -34.3, longitude: -58.3, gpsAccuracy: 4, gpsCapturedAt: '2026-10-08T10:40:00' };

const grupo = (id: string, nombre: string, codigo: string) => ({
  id, plantacionId: PLANTACION, parcelaId: PARCELA, nombre, codigo, tipo: 'linea', estado: 'finalizada',
  usuarioCreador: TECNICO, createdAt: CREADO, pendingSync: true,
});

const conflicto = (entidadId: string, campo: string, mio: unknown) => ({
  entidadId, campo: campo as never, grupoId: GRUPO, plantacionId: PLANTACION, mio, servidor: null,
  detectadoEn: '2026-10-08T10:00:00',
});

const motivos = async () =>
  Object.fromEntries((await conflictosParaResolver(PLANTACION)).map((c) => [c.conflicto.campo, c.motivo]));

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  conRolCacheado('tecnico', TECNICO);
  await vaciarTablas(mockTestDb);
  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION }));
  await mockTestDb.insert(parcelas).values(createTestParcela({ id: PARCELA, plantacionId: PLANTACION }));
  await mockTestDb.insert(species).values([
    { id: ROBLE, codigo: 'ROB', nombre: 'Roble', nombreCientifico: null, createdAt: CREADO },
    { id: PINO, codigo: 'PT', nombre: 'Pinus taeda', nombreCientifico: null, createdAt: CREADO },
  ]);
  await mockTestDb.insert(plantationSpecies).values({ id: 'ps-1', plantacionId: PLANTACION, especieId: PINO, ordenVisual: 0 });
  await mockTestDb.insert(groups).values([grupo(GRUPO, 'Linea norte', 'LN'), grupo('g-2', 'Linea sur', 'LS')]);
  await mockTestDb.insert(trees).values({
    id: 't-1', groupId: GRUPO, especieId: PINO, posicion: 1, subId: 'X1LNPT1', fotoUrl: null, fotoSynced: false,
    usuarioRegistro: TECNICO, createdAt: CREADO, latitude: -34.31, longitude: -58.3, gpsAccuracy: 12,
    gpsCapturedAt: '2026-10-07T18:03:00',
  });
});

describe('conflictosParaResolver', () => {
  it('trae cada conflicto con el árbol, el grupo y las especies de los dos lados', async () => {
    await mockTestDb.insert(conflictosDeSync).values([conflicto('t-1', 'gps', MI_PUNTO), conflicto('t-1', 'especie', PINO)]);

    const [especie, gps] = (await conflictosParaResolver(PLANTACION))
      .sort((a, b) => a.conflicto.campo.localeCompare(b.conflicto.campo));

    expect(gps).toMatchObject({ arbol: { subId: 'X1LNPT1', latitude: -34.31 }, grupo: { codigo: 'LN' }, motivo: null });
    expect(especie.especies).toEqual({ mia: { nombre: 'Pinus taeda', codigo: 'PT' }, servidor: { nombre: 'Pinus taeda', codigo: 'PT' } });
  });

  it('los casos en que no se puede conservar lo propio', async () => {
    await mockTestDb.insert(conflictosDeSync).values([
      conflicto('t-1', 'especie', ROBLE),
      conflicto('t-1', 'gps', { ...MI_PUNTO, gpsCapturedAt: null }),
      conflicto(GRUPO, 'nombre', 'Linea sur'),
      conflicto(GRUPO, 'codigo', 'nuevo'),
    ]);

    expect(await motivos()).toEqual({
      especie: 'conflicto_sin_valor',
      gps: 'conflicto_sin_valor',
      nombre: 'nombre_duplicate',
      codigo: null,
    });
  });

  it('un árbol borrado o una plantación finalizada no dejan conservar lo propio', async () => {
    await mockTestDb.insert(conflictosDeSync).values([conflicto('t-borrado', 'foto', 'file:///mia.jpg')]);
    expect(await motivos()).toEqual({ foto: 'conflicto_inexistente' });

    await mockTestDb.insert(conflictosDeSync).values(conflicto('t-1', 'gps', MI_PUNTO));
    await mockTestDb.update(plantations).set({ estado: 'finalizada' }).where(eq(plantations.id, PLANTACION));
    expect((await motivos()).gps).toBe('plantacion_no_editable');
  });

  it('en un grupo ajeno, el técnico no puede conservar lo propio de un árbol', async () => {
    await mockTestDb.update(groups).set({ usuarioCreador: 'otro-tecnico' }).where(eq(groups.id, GRUPO));
    await mockTestDb.insert(conflictosDeSync).values(conflicto('t-1', 'gps', MI_PUNTO));

    expect((await motivos()).gps).toBe('sin_permiso');
  });
});

describe('resolverConflictosDeSync', () => {
  it('aplica cada elección y cuenta las que no se pudieron', async () => {
    await mockTestDb.insert(conflictosDeSync).values([conflicto('t-1', 'gps', MI_PUNTO), conflicto(GRUPO, 'tipo', 'bosquete')]);

    const fallidas = await resolverConflictosDeSync([
      { entidadId: 't-1', campo: 'gps', conservar: true },
      { entidadId: GRUPO, campo: 'tipo', conservar: false },
      { entidadId: 't-x', campo: 'foto', conservar: false },
    ]);

    expect(fallidas).toBe(1);
    const [arbol] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
    expect(arbol).toMatchObject({ latitude: -34.3, gpsAccuracy: 4 });
    expect(await mockTestDb.select().from(conflictosDeSync)).toEqual([]);
  });
});

describe('avisos', () => {
  it('cuentan por plantación y marcan qué tiene cada grupo', async () => {
    await mockTestDb.insert(conflictosDeSync).values([conflicto('t-1', 'gps', MI_PUNTO), conflicto(GRUPO, 'nombre', 'Otra')]);

    expect(await conflictosDeSyncPorPlantacion()).toEqual([{ plantacionId: PLANTACION, cantidad: 2 }]);
    expect(await conflictosDeSyncDeGrupo(GRUPO)).toEqual(expect.arrayContaining([
      { entidadId: 't-1', campo: 'gps' },
      { entidadId: GRUPO, campo: 'nombre' },
    ]));
  });
});
