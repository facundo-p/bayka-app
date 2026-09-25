/**
 * Ciclo de vida de un grupo en `GroupRepository`, contra SQLite real: alta,
 * unicidad por parcela (#90), finalizar/reactivar, y lo que el sync lee y marca.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, vaciarTablas, IntegrationDb } from '../helpers/integrationDb';
import { createTestGroup, createTestParcela, createTestPlantation } from '../helpers/factories';
import { groups, parcelas, plantations } from '../../src/database/schema';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));

import {
  createGroup,
  finalizeGroup,
  reactivateGroup,
  markGroupSynced,
  getSyncableGroups,
} from '../../src/repositories/GroupRepository';

const PLANTACION_ID = 'plant-1';
const PARCELA_ID = 'parc-1';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION_ID }));
  await mockTestDb.insert(parcelas).values(createTestParcela({ id: PARCELA_ID, plantacionId: PLANTACION_ID }));
});

const leerGrupo = async (id: string) => (await mockTestDb.select().from(groups).where(eq(groups.id, id)))[0];

const altaDeGrupo = (overrides: Partial<Parameters<typeof createGroup>[0]> = {}) =>
  createGroup({
    plantacionId: PLANTACION_ID,
    parcelaId: PARCELA_ID,
    nombre: 'Linea A',
    codigo: 'la',
    tipo: 'linea',
    usuarioCreador: 'user-tecnico-1',
    ...overrides,
  });

async function grupoCreado(overrides: Partial<Parameters<typeof createGroup>[0]> = {}): Promise<string> {
  const res = await altaDeGrupo(overrides);
  if (!res.success) throw new Error(`alta de grupo rechazada: ${res.error}`);
  return res.id;
}

describe('createGroup', () => {
  test('nace activa, pendiente de subir y con el código en mayúsculas', async () => {
    const fila = await leerGrupo(await grupoCreado());

    expect(fila.estado).toBe('activa');
    expect(fila.pendingSync).toBe(true);
    expect(fila.codigo).toBe('LA');
    expect(fila.parcelaId).toBe(PARCELA_ID);
  });

  test('código repetido en la misma parcela: lo rechaza sin escribir', async () => {
    await grupoCreado();

    const res = await altaDeGrupo({ nombre: 'Linea B', codigo: 'LA' });

    expect(res).toEqual({ success: false, error: 'codigo_duplicate' });
    expect(await mockTestDb.select().from(groups)).toHaveLength(1);
  });

  test('nombre repetido en la misma parcela: lo rechaza', async () => {
    await grupoCreado();

    expect(await altaDeGrupo({ codigo: 'LB' })).toEqual({ success: false, error: 'nombre_duplicate' });
  });

  test('nombre y código repetidos: informa los dos', async () => {
    await grupoCreado();

    expect(await altaDeGrupo()).toEqual({ success: false, error: 'both_duplicate' });
  });

  test('el mismo código en otra parcela de la plantación está permitido', async () => {
    await mockTestDb.insert(parcelas).values(
      createTestParcela({ id: 'parc-2', plantacionId: PLANTACION_ID, nombre: 'Parcela 2', codigo: 'P2' }),
    );
    await grupoCreado();

    const res = await altaDeGrupo({ parcelaId: 'parc-2' });

    expect(res.success).toBe(true);
    expect(await mockTestDb.select().from(groups)).toHaveLength(2);
  });
});

describe('finalizar y reactivar', () => {
  test('finalizeGroup la pasa a finalizada y la deja pendiente de subir', async () => {
    const id = await grupoCreado();
    await markGroupSynced(id);

    await finalizeGroup(id);

    const fila = await leerGrupo(id);
    expect(fila.estado).toBe('finalizada');
    expect(fila.pendingSync).toBe(true);
  });

  test('reactivateGroup la vuelve a activa y la deja pendiente de subir', async () => {
    const id = await grupoCreado();
    await finalizeGroup(id);
    await markGroupSynced(id);

    await reactivateGroup(id);

    const fila = await leerGrupo(id);
    expect(fila.estado).toBe('activa');
    expect(fila.pendingSync).toBe(true);
  });
});

describe('markGroupSynced', () => {
  // Forzar 'sincronizada' hacía que un grupo activa dejara de bloquear la finalización (#60).
  test.each(['activa', 'finalizada'])('baja pendingSync y conserva el estado %s', async (estado) => {
    const id = await grupoCreado();
    if (estado === 'finalizada') await finalizeGroup(id);

    await markGroupSynced(id);

    const fila = await leerGrupo(id);
    expect(fila.pendingSync).toBe(false);
    expect(fila.estado).toBe(estado);
  });
});

describe('getSyncableGroups', () => {
  const grupoLocal = (id: string, codigo: string, extra: Partial<typeof groups.$inferInsert>) => ({
    ...createTestGroup({ id, plantacionId: PLANTACION_ID, parcelaId: PARCELA_ID, nombre: `G ${codigo}`, codigo }),
    ...extra,
  });

  test('devuelve todo grupo pendiente de la plantación, sin filtrar por estado ni por creador', async () => {
    await mockTestDb.insert(groups).values([
      grupoLocal('g-activa', 'GA', { estado: 'activa', pendingSync: true }),
      grupoLocal('g-finalizada', 'GF', { estado: 'finalizada', pendingSync: true }),
      grupoLocal('g-sincronizada', 'GS', { estado: 'sincronizada', pendingSync: true }),
      grupoLocal('g-ajeno', 'GJ', { usuarioCreador: 'otro-tecnico', pendingSync: true }),
      grupoLocal('g-al-dia', 'GD', { estado: 'finalizada', pendingSync: false }),
    ]);

    const ids = (await getSyncableGroups(PLANTACION_ID, 'user-tecnico-1')).map((g) => g.id).sort();

    expect(ids).toEqual(['g-activa', 'g-ajeno', 'g-finalizada', 'g-sincronizada']);
  });

  test('no mezcla grupos de otra plantación', async () => {
    await mockTestDb.insert(plantations).values(createTestPlantation({ id: 'plant-2' }));
    await mockTestDb.insert(parcelas).values(createTestParcela({ id: 'parc-otra', plantacionId: 'plant-2' }));
    await mockTestDb.insert(groups).values({
      ...createTestGroup({ id: 'g-otra', plantacionId: 'plant-2', parcelaId: 'parc-otra' }),
      pendingSync: true,
    });

    expect(await getSyncableGroups(PLANTACION_ID)).toEqual([]);
  });
});
