/**
 * Pendientes varados (#638), contra SQLite real: el motivo que guarda el sync, lo que la
 * tarjeta lee y "Descartar". Una plantación que existe en el server se queda, sin sus
 * pendientes; un alta sin subir o una eliminada en el servidor se va del dispositivo.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import {
  createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas, sembrarEspecieDeTest,
} from '../helpers/integrationDb';
import {
  createTestPlantation, createTestParcela, createTestGroup, createTestTree, createTestSpecies, TEST_SPECIES_ID,
} from '../helpers/factories';
import {
  plantations, parcelas, groups, trees, species, plantationSpecies, plantationUsers,
  cambiosEspeciesPendientes, altasDeTecnicosPendientes, borradosPendientes,
} from '../../src/database/schema';
import { plantationSpeciesId } from '../../src/utils/plantationSpeciesId';

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/supabase/client', () => ({ supabase: {} }));
jest.mock('../../src/database/client', () => ({
  get db() { return mockTestDb; },
  get sqlite() { return mockSqliteDeIntegracion; },
}));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('../../src/services/PhotoService', () => ({
  ...jest.requireActual('../../src/services/PhotoService'),
  borrarFotosLocales: jest.fn(),
}));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { descartarPendientes, guardarMotivoVarado, limpiarMotivoVarado } from '../../src/repositories/PendientesVaradosRepository';
import { getPendientesVarados, getDescarteDePlantacion } from '../../src/queries/pendientesVaradosQueries';
import { anotarPullConAcceso, anotarRechazo, anotarSubida, conRegistroDeVarados } from '../../src/services/sync/pendientesVarados';
import { borrarFotosLocales } from '../../src/services/PhotoService';

const P = 'plant-finalizada';
const OTRA_ESPECIE = 'species-pino';
const TECNICO = 'user-tecnico-9';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  jest.clearAllMocks();
  await vaciarTablas(mockTestDb);
  await sembrarEspecieDeTest(mockTestDb);
  await mockTestDb.insert(species).values(createTestSpecies({ id: OTRA_ESPECIE, codigo: 'PIN', nombre: 'Pino' }));
});

const plantacion = async () => (await mockTestDb.select().from(plantations).where(eq(plantations.id, P)))[0];
const ids = async (tabla: typeof groups | typeof parcelas | typeof trees) =>
  (await mockTestDb.select({ id: tabla.id }).from(tabla)).map((f) => f.id).sort();

/**
 * De todo pendiente: edición, un alta y una baja de especie, un técnico, una parcela nueva
 * con su grupo pendiente, una parcela subida y editada con un grupo ya subido, un grupo
 * pendiente en una parcela subida, una foto sin subir en un grupo subido y un borrado.
 */
async function sembrarConPendientes(motivo: 'sin-permiso' | 'finalizada' = 'sin-permiso') {
  await mockTestDb.insert(plantations).values({
    ...createTestPlantation({ id: P, estado: motivo === 'finalizada' ? 'finalizada' : 'activa', lugar: 'Editado', periodo: '2026' }),
    motivoVarado: motivo, lugarServer: 'Original', periodoServer: '2026', pendingEdit: true,
  });
  // En el server: TEST_SPECIES_ID. En el teléfono: la quitó y sumó OTRA_ESPECIE.
  await mockTestDb.insert(plantationSpecies).values({ id: plantationSpeciesId(P, OTRA_ESPECIE), plantacionId: P, especieId: OTRA_ESPECIE });
  await mockTestDb.insert(cambiosEspeciesPendientes).values([
    { plantacionId: P, especieId: OTRA_ESPECIE, tipo: 'alta', cambiadoEn: '2026-09-20' },
    { plantacionId: P, especieId: TEST_SPECIES_ID, tipo: 'baja', cambiadoEn: '2026-09-20' },
  ]);
  await mockTestDb.insert(plantationUsers).values([
    { plantationId: P, userId: 'user-admin', rolEnPlantacion: 'admin', assignedAt: '2026-01-01' },
    { plantationId: P, userId: TECNICO, rolEnPlantacion: 'tecnico', assignedAt: '2026-09-20' },
  ]);
  await mockTestDb.insert(altasDeTecnicosPendientes).values({ plantacionId: P, userId: TECNICO, nombre: 'Ana', asignadoEn: '2026-09-20' });
  await mockTestDb.insert(parcelas).values([
    createTestParcela({ id: 'parc-subida', plantacionId: P, codigo: 'P1', nombre: 'Uno', pendingSync: false }),
    createTestParcela({ id: 'parc-editada', plantacionId: P, codigo: 'P3', nombre: 'Tres', pendingSync: true }),
    createTestParcela({ id: 'parc-nueva', plantacionId: P, codigo: 'P2', nombre: 'Dos', pendingSync: true }),
  ]);
  await mockTestDb.insert(groups).values([
    { ...createTestGroup({ id: 'g-subido', plantacionId: P, parcelaId: 'parc-subida', codigo: 'LA', nombre: 'A' }), pendingSync: false },
    { ...createTestGroup({ id: 'g-pendiente', plantacionId: P, parcelaId: 'parc-subida', codigo: 'LB', nombre: 'B' }), pendingSync: true },
    { ...createTestGroup({ id: 'g-de-editada', plantacionId: P, parcelaId: 'parc-editada', codigo: 'LD', nombre: 'D' }), pendingSync: false },
    { ...createTestGroup({ id: 'g-de-nueva', plantacionId: P, parcelaId: 'parc-nueva', codigo: 'LC', nombre: 'C' }), pendingSync: true },
  ]);
  await mockTestDb.insert(trees).values([
    createTestTree({ id: 't-foto-sin-subir', groupId: 'g-subido', fotoUrl: 'file://sin-subir.jpg', fotoSynced: false }),
    createTestTree({ id: 't-foto-subida', groupId: 'g-subido', posicion: 2, fotoUrl: 'file://subida.jpg', fotoSynced: true }),
    createTestTree({ id: 't-pendiente', groupId: 'g-pendiente', fotoUrl: 'file://pendiente.jpg' }),
    createTestTree({ id: 't-de-editada', groupId: 'g-de-editada', fotoUrl: 'file://de-editada.jpg', fotoSynced: true }),
    createTestTree({ id: 't-de-nueva', groupId: 'g-de-nueva' }),
  ]);
  await mockTestDb.insert(borradosPendientes).values({ id: 't-borrado', tipo: 'arbol', grupoId: 'g-subido', plantacionId: P, borradoEn: '2026-09-20' });
}

describe('lo que lee la tarjeta', () => {
  it('con motivo y pendientes: el motivo y el detalle por tipo', async () => {
    await sembrarConPendientes();

    const varados = (await getPendientesVarados()).get(P);

    expect(varados?.motivo).toBe('sin-permiso');
    expect(varados?.resumen).toMatchObject({
      edicion: true, alta: false, activaCount: 2, parcelas: 2, especies: 2, tecnicos: 1, borrados: 1,
    });
  });

  it('las fotos de un grupo pendiente van con el grupo: solo cuentan las de grupos subidos', async () => {
    await sembrarConPendientes();

    expect((await getPendientesVarados()).get(P)?.resumen.fotos).toBe(1);
  });

  it('en una finalizada no cuenta lo que el server acepta igual: técnicos y fotos de grupos subidos', async () => {
    await sembrarConPendientes('finalizada');

    expect((await getPendientesVarados()).get(P)?.resumen).toMatchObject({ tecnicos: 0, fotos: 0 });
  });

  it('con motivo pero sin nada pendiente: no avisa y limpia el motivo', async () => {
    await mockTestDb.insert(plantations).values({ ...createTestPlantation({ id: P }), motivoVarado: 'archivada' });

    expect((await getPendientesVarados()).has(P)).toBe(false);
    expect((await plantacion()).motivoVarado).toBeNull();
  });

  it('eliminada en el servidor: avisa aunque el sync no haya guardado motivo', async () => {
    await mockTestDb.insert(plantations).values({ ...createTestPlantation({ id: P, eliminadaEnServidorEn: '2026-09-20' }), pendingEdit: true });

    expect((await getPendientesVarados()).get(P)?.motivo).toBe('eliminada');
    expect((await getDescarteDePlantacion(P))?.seVa).toBe(true);
  });

  it('un alta cuyo insert subió: la confirmación sabe que existe en el server', async () => {
    await mockTestDb.insert(plantations).values({
      ...createTestPlantation({ id: P, pendingSync: true }), lugarServer: 'Campo', motivoVarado: 'finalizada',
    });

    expect((await getDescarteDePlantacion(P))?.resumen).toMatchObject({ alta: true, altaEnServidor: true });
  });
});

describe('Descartar una plantación que existe en el server', () => {
  it('la plantación queda, con la edición revertida y sin motivo', async () => {
    await sembrarConPendientes();
    await descartarPendientes(P);

    const fila = await plantacion();
    expect(fila).toMatchObject({ lugar: 'Original', pendingEdit: false, baseDeEdicion: null, motivoVarado: null });
  });

  it('las especies vuelven a como están en el server y la cola queda vacía', async () => {
    await sembrarConPendientes();
    await descartarPendientes(P);

    const habilitadas = (await mockTestDb.select().from(plantationSpecies)).map((ps) => ps.especieId);
    expect(habilitadas).toEqual([TEST_SPECIES_ID]);
    expect(await mockTestDb.select().from(cambiosEspeciesPendientes)).toEqual([]);
  });

  it('el técnico asignado en el teléfono se quita; el admin queda', async () => {
    await sembrarConPendientes();
    await descartarPendientes(P);

    expect((await mockTestDb.select().from(plantationUsers)).map((u) => u.userId)).toEqual(['user-admin']);
    expect(await mockTestDb.select().from(altasDeTecnicosPendientes)).toEqual([]);
  });

  it('se van los grupos pendientes y la parcela nueva; lo ya subido queda aunque su parcela estuviera pendiente', async () => {
    await sembrarConPendientes();
    await descartarPendientes(P);

    expect(await ids(parcelas)).toEqual(['parc-editada', 'parc-subida']);
    expect(await ids(groups)).toEqual(['g-de-editada', 'g-subido']);
    expect(await ids(trees)).toEqual(['t-de-editada', 't-foto-sin-subir', 't-foto-subida']);
    const [editada] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, 'parc-editada'));
    expect(editada.pendingSync).toBe(false);
    expect(await mockTestDb.select().from(borradosPendientes)).toEqual([]);
  });

  it('la foto sin subir se suelta y se borran los archivos que quedan sin fila', async () => {
    await sembrarConPendientes();
    await descartarPendientes(P);

    const [sinSubir] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-foto-sin-subir'));
    expect(sinSubir.fotoUrl).toBeNull();
    const [subida] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-foto-subida'));
    expect(subida.fotoUrl).toBe('file://subida.jpg');
    expect((borrarFotosLocales as jest.Mock).mock.calls[0][0].sort()).toEqual(['file://pendiente.jpg', 'file://sin-subir.jpg']);
  });

  it('en una finalizada conserva los técnicos y las fotos sin subir: el server los acepta', async () => {
    await sembrarConPendientes('finalizada');
    await descartarPendientes(P);

    expect(await mockTestDb.select().from(altasDeTecnicosPendientes)).toHaveLength(1);
    const [sinSubir] = await mockTestDb.select().from(trees).where(eq(trees.id, 't-foto-sin-subir'));
    expect(sinSubir.fotoUrl).toBe('file://sin-subir.jpg');
    expect(await ids(groups)).toEqual(['g-de-editada', 'g-subido']);
  });
});

describe('Descartar lo que no existe en el server', () => {
  it('un alta sin subir se va del dispositivo', async () => {
    await mockTestDb.insert(plantations).values({ ...createTestPlantation({ id: P, pendingSync: true }), motivoVarado: 'sin-permiso' });
    await mockTestDb.insert(parcelas).values(createTestParcela({ id: 'parc', plantacionId: P, pendingSync: true }));

    expect((await getDescarteDePlantacion(P))?.seVa).toBe(true);
    await descartarPendientes(P);

    expect(await plantacion()).toBeUndefined();
    expect(await ids(parcelas)).toEqual([]);
  });

  it('una eliminada en el servidor se va del dispositivo', async () => {
    await mockTestDb.insert(plantations).values(createTestPlantation({ id: P, eliminadaEnServidorEn: '2026-09-20' }));

    await descartarPendientes(P);

    expect(await plantacion()).toBeUndefined();
  });
});

describe('motivo guardado por el sync', () => {
  beforeEach(async () => {
    await mockTestDb.insert(plantations).values(createTestPlantation({ id: P }));
  });

  it('un rechazo y una subida en la misma corrida: gana el rechazo', async () => {
    await conRegistroDeVarados(async () => {
      await anotarSubida(P);
      await anotarRechazo(P, 'NOT_AUTHORIZED');
    });

    expect((await plantacion()).motivoVarado).toBe('sin-permiso');
  });

  it('un error transitorio no toca el motivo', async () => {
    await guardarMotivoVarado(P, 'finalizada');

    await conRegistroDeVarados(() => anotarRechazo(P, 'NETWORK'));

    expect((await plantacion()).motivoVarado).toBe('finalizada');
  });

  it('una subida aceptada sin rechazos lo limpia', async () => {
    await guardarMotivoVarado(P, 'finalizada');

    await conRegistroDeVarados(() => anotarSubida(P));

    expect((await plantacion()).motivoVarado).toBeNull();
  });

  it('con acceso, una plantación cerrada queda varada por su estado aunque nada lo haya rechazado', async () => {
    await mockTestDb.update(plantations).set({ archivadaEn: '2026-09-20' }).where(eq(plantations.id, P));

    await conRegistroDeVarados(() => anotarPullConAcceso(P));

    expect((await plantacion()).motivoVarado).toBe('archivada');
  });

  it('con acceso y reabierta, la corrida limpia cualquier motivo', async () => {
    await guardarMotivoVarado(P, 'sin-permiso');

    await conRegistroDeVarados(() => anotarPullConAcceso(P));

    expect((await plantacion()).motivoVarado).toBeNull();
  });

  it('un pull suelto solo limpia lo que depende del estado: no reintentó lo demás', async () => {
    await guardarMotivoVarado(P, 'sin-permiso');
    await conRegistroDeVarados(() => anotarPullConAcceso(P), false);
    expect((await plantacion()).motivoVarado).toBe('sin-permiso');

    await guardarMotivoVarado(P, 'finalizada');
    await conRegistroDeVarados(() => anotarPullConAcceso(P), false);
    expect((await plantacion()).motivoVarado).toBeNull();
  });

  it('fuera de una corrida no se guarda nada: la sesión pudo no ser válida', async () => {
    await anotarRechazo(P, 'PERMISSION');

    expect((await plantacion()).motivoVarado).toBeNull();
  });

  it('solapadas, se aplica una sola vez al terminar la última', async () => {
    let terminarPull!: () => void;
    const pull = conRegistroDeVarados(() => new Promise<void>((r) => { terminarPull = r; }), false);
    await conRegistroDeVarados(() => anotarRechazo(P, 'PLANTACION_ARCHIVADA'));
    expect((await plantacion()).motivoVarado).toBeNull();

    terminarPull();
    await pull;
    expect((await plantacion()).motivoVarado).toBe('archivada');
  });

  it('limpiar solo ciertos motivos no toca los demás', async () => {
    await guardarMotivoVarado(P, 'sin-permiso');

    await limpiarMotivoVarado(P, ['finalizada']);

    expect((await plantacion()).motivoVarado).toBe('sin-permiso');
  });
});
