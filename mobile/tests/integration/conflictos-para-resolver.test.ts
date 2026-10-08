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
import { conservarLaMia } from '../../src/services/ConflictosDeSyncService';
import { borrarFotosLocales } from '../../src/services/PhotoService';
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

const DETECTADO = '2026-10-08T10:00:00';

const conflicto = (entidadId: string, campo: string, mio: unknown, grupoId = GRUPO) => ({
  entidadId, campo: campo as never, grupoId, plantacionId: PLANTACION, mio, servidor: null, detectadoEn: DETECTADO,
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

  it('código duplicado, especie recuperada, N/N, estado o tipo desconocido, foto quitada y grupo borrado', async () => {
    await mockTestDb.insert(species).values({ id: 'sp-rec', codigo: 'recuperada:X', nombre: 'Recuperada', nombreCientifico: null, createdAt: CREADO });
    await mockTestDb.insert(plantationSpecies).values({ id: 'ps-2', plantacionId: PLANTACION, especieId: 'sp-rec', ordenVisual: 1 });
    await mockTestDb.insert(conflictosDeSync).values([
      conflicto('t-1', 'especie', 'sp-rec'),
      conflicto('t-1', 'foto', null),
      conflicto(GRUPO, 'codigo', 'ls'),
      conflicto(GRUPO, 'estado', 'sincronizada'),
      conflicto(GRUPO, 'tipo', 'otro'),
    ]);

    expect(await motivos()).toEqual({
      especie: 'conflicto_sin_valor',
      foto: 'conflicto_sin_valor',
      codigo: 'codigo_duplicate',
      estado: 'conflicto_sin_valor',
      tipo: 'conflicto_sin_valor',
    });

    await mockTestDb.delete(conflictosDeSync);
    await mockTestDb.insert(conflictosDeSync).values([conflicto('t-1', 'especie', null), conflicto('g-borrado', 'nombre', 'X', 'g-borrado')]);
    expect(await motivos()).toEqual({ especie: 'conflicto_sin_valor', nombre: 'conflicto_inexistente' });
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

type Fila = ReturnType<typeof conflicto>;

const finalizarPlantacion = () => mockTestDb.update(plantations).set({ estado: 'finalizada' }).where(eq(plantations.id, PLANTACION));
const grupoAjeno = () => mockTestDb.update(groups).set({ usuarioCreador: 'otro-tecnico' }).where(eq(groups.id, GRUPO));
const sinPreparar = async () => undefined;

/** [caso, se puede conservar, conflicto, preparación] */
const CASOS: [string, boolean, Fila, () => Promise<unknown>][] = [
  ['GPS completo', true, conflicto('t-1', 'gps', MI_PUNTO), sinPreparar],
  ['GPS sin momento', false, conflicto('t-1', 'gps', { ...MI_PUNTO, gpsCapturedAt: null }), sinPreparar],
  ['especie de la plantación', true, conflicto('t-1', 'especie', PINO), sinPreparar],
  ['especie fuera de la plantación', false, conflicto('t-1', 'especie', ROBLE), sinPreparar],
  ['N/N', false, conflicto('t-1', 'especie', null), sinPreparar],
  ['foto propia', true, conflicto('t-1', 'foto', 'file:///mia.jpg'), sinPreparar],
  ['foto quitada', false, conflicto('t-1', 'foto', null), sinPreparar],
  ['código libre', true, conflicto(GRUPO, 'codigo', 'nuevo'), sinPreparar],
  ['código duplicado', false, conflicto(GRUPO, 'codigo', 'ls'), sinPreparar],
  ['nombre duplicado', false, conflicto(GRUPO, 'nombre', 'Linea sur'), sinPreparar],
  ['tipo conocido', true, conflicto(GRUPO, 'tipo', 'bosquete'), sinPreparar],
  ['tipo desconocido', false, conflicto(GRUPO, 'tipo', 'otro'), sinPreparar],
  ['estado conocido', true, conflicto(GRUPO, 'estado', 'activa'), sinPreparar],
  ['estado desconocido', false, conflicto(GRUPO, 'estado', 'sincronizada'), sinPreparar],
  ['grupo borrado', false, conflicto('g-borrado', 'estado', 'activa', 'g-borrado'), sinPreparar],
  ['árbol borrado', false, conflicto('t-borrado', 'gps', MI_PUNTO), sinPreparar],
  ['plantación finalizada', false, conflicto('t-1', 'gps', MI_PUNTO), finalizarPlantacion],
  ['grupo ajeno', false, conflicto('t-1', 'gps', MI_PUNTO), grupoAjeno],
];

describe('el motivo anticipa a conservarLaMia', () => {
  it.each(CASOS)('%s: con motivo falla, sin motivo se aplica', async (_caso, seConserva, fila, preparar) => {
    await preparar();
    await mockTestDb.insert(conflictosDeSync).values(fila);
    const [{ motivo }] = await conflictosParaResolver(PLANTACION);

    const resultado = await conservarLaMia(fila.entidadId, fila.campo);

    expect(motivo === null).toBe(seConserva);
    expect(resultado.success).toBe(seConserva);
  });
});

describe('resolverConflictosDeSync', () => {
  const sinConflictos = async () => expect(await mockTestDb.select().from(conflictosDeSync)).toEqual([]);

  it('aplica cada elección; uno que ya no está cuenta como resuelto', async () => {
    await mockTestDb.insert(conflictosDeSync).values([conflicto('t-1', 'gps', MI_PUNTO), conflicto(GRUPO, 'tipo', 'bosquete')]);

    const fallidas = await resolverConflictosDeSync([
      { entidadId: 't-1', campo: 'gps', detectadoEn: DETECTADO, conservar: true },
      { entidadId: GRUPO, campo: 'tipo', detectadoEn: DETECTADO, conservar: false },
      { entidadId: 't-x', campo: 'foto', detectadoEn: DETECTADO, conservar: false },
    ]);

    expect(fallidas).toEqual([]);
    const [arbol] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
    expect(arbol).toMatchObject({ latitude: -34.3, gpsAccuracy: 4 });
    await sinConflictos();
  });

  it('si el servidor cambió el dato desde que se eligió, no aplica nada y avisa que cambió', async () => {
    await mockTestDb.insert(conflictosDeSync).values({ ...conflicto('t-1', 'gps', MI_PUNTO), detectadoEn: '2026-10-08T11:00:00' });

    const fallidas = await resolverConflictosDeSync([{ entidadId: 't-1', campo: 'gps', detectadoEn: DETECTADO, conservar: true }]);

    expect(fallidas).toEqual([{ entidadId: 't-1', campo: 'gps', falla: 'cambio' }]);
    const [arbol] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
    expect(arbol.latitude).toBe(-34.31);
    expect(await mockTestDb.select().from(conflictosDeSync)).toHaveLength(1);
  });

  it('lo que no se pudo aplicar vuelve como error', async () => {
    await mockTestDb.insert(conflictosDeSync).values(conflicto(GRUPO, 'nombre', 'Linea sur'));

    const fallidas = await resolverConflictosDeSync([{ entidadId: GRUPO, campo: 'nombre', detectadoEn: DETECTADO, conservar: true }]);

    expect(fallidas).toEqual([{ entidadId: GRUPO, campo: 'nombre', falla: 'error' }]);
  });

  describe('foto', () => {
    const DEL_SERVIDOR = 'plantations/p-1/trees/t-1.jpg';
    const MIA = 'file:///mia.jpg';

    beforeEach(async () => {
      await mockTestDb.update(trees).set({ fotoUrl: DEL_SERVIDOR, fotoSynced: true }).where(eq(trees.id, 't-1'));
      await mockTestDb.insert(conflictosDeSync).values(conflicto('t-1', 'foto', MIA));
      (borrarFotosLocales as jest.Mock).mockClear();
    });

    it('quedarse con la del servidor borra el archivo propio', async () => {
      await resolverConflictosDeSync([{ entidadId: 't-1', campo: 'foto', detectadoEn: DETECTADO, conservar: false }]);

      expect(borrarFotosLocales).toHaveBeenCalledWith([MIA]);
      await sinConflictos();
    });

    it('conservarla la deja como foto del árbol y no la borra', async () => {
      await resolverConflictosDeSync([{ entidadId: 't-1', campo: 'foto', detectadoEn: DETECTADO, conservar: true }]);

      const llamadas = (borrarFotosLocales as jest.Mock).mock.calls.flat(2);
      expect(llamadas).not.toContain(MIA);
      const [arbol] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-1'));
      expect(arbol).toMatchObject({ fotoUrl: MIA, fotoSynced: false });
      await sinConflictos();
    });
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
