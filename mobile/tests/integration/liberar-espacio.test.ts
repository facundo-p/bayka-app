/**
 * "Liberar espacio" (#565) contra SQLite real: borra del celular solo las fotos
 * que el server confirma, deja la fila apuntando a Storage y nunca toca una foto
 * sin subir ni escribe en el server o en `borrados_pendientes`.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import {
  createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb, vaciarTablas, sembrarEspecieDeTest,
} from '../helpers/integrationDb';
import { createTestGroup, createTestParcela, createTestPlantation, createTestTree } from '../helpers/factories';
import { borradosPendientes, groups, parcelas, plantations, trees } from '../../src/database/schema';

const mockServer = {
  trees: new Map<string, { id: string; foto_url: string | null }>(),
  falla: false,
  escrituras: 0,
};

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: () => {
      const api: any = {
        select: () => api,
        in: (_col: string, ids: string[]) =>
          Promise.resolve(
            mockServer.falla
              ? { data: null, error: { message: 'Network request failed' } }
              : { data: ids.map((id) => mockServer.trees.get(id)).filter(Boolean), error: null },
          ),
        update: () => { mockServer.escrituras++; return api; },
        delete: () => { mockServer.escrituras++; return api; },
      };
      return api;
    },
    rpc: () => { mockServer.escrituras++; return Promise.resolve({ data: null, error: null }); },
  },
}));

const CARPETA = 'file:///docs/tree-photos/';
jest.mock('../../src/services/PhotoService', () => ({
  borrarFotosLocales: jest.fn(),
  esFotoDeLaApp: (uri: string) => uri.startsWith('file:///docs/tree-photos/'),
  pesoDeFotoLocal: () => 1000,
}));

let mockTestDb: IntegrationDb;
let mockSqliteDeIntegracion: ReturnType<typeof sqliteDeIntegracion>;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
  get sqlite() {
    return mockSqliteDeIntegracion;
  },
}));

jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { borrarFotosLocales } from '../../src/services/PhotoService';
import { liberarEspacio, prepararLiberacion, resumenDeEspacio } from '../../src/services/LiberarEspacioService';

const GRUPO_ID = 'g-1';

async function arbol(id: string, fotoUrl: string | null, fotoSynced: boolean) {
  await mockTestDb.insert(trees).values(createTestTree({ id, groupId: GRUPO_ID, fotoUrl, fotoSynced, posicion: 1 }));
}

async function fotoDe(id: string) {
  const [fila] = await mockTestDb.select({ fotoUrl: trees.fotoUrl, fotoSynced: trees.fotoSynced })
    .from(trees).where(eq(trees.id, id));
  return fila;
}

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  jest.clearAllMocks();
  mockServer.trees.clear();
  mockServer.falla = false;
  mockServer.escrituras = 0;
  await vaciarTablas(mockTestDb);
  await sembrarEspecieDeTest(mockTestDb);
  await mockTestDb.insert(plantations).values(createTestPlantation({ id: 'p-1' }));
  await mockTestDb.insert(parcelas).values(createTestParcela({ id: 'parc-1', plantacionId: 'p-1' }));
  await mockTestDb.insert(groups).values(createTestGroup({ id: GRUPO_ID, plantacionId: 'p-1', parcelaId: 'parc-1' }));

  // Descargada y confirmada por el server: se libera.
  await arbol('t-bajada', `${CARPETA}photo_t-bajada.jpg`, true);
  mockServer.trees.set('t-bajada', { id: 't-bajada', foto_url: 'org/p-1/t-bajada.jpg' });
  // Sacada en este celular y todavía sin subir: única copia, no se toca.
  await arbol('t-pendiente', `${CARPETA}photo_t-pendiente.jpg`, false);
  mockServer.trees.set('t-pendiente', { id: 't-pendiente', foto_url: null });
  // Subida acá pero quitada en otro celular: el server no la confirma, se conserva.
  await arbol('t-quitada', `${CARPETA}photo_t-quitada.jpg`, true);
  mockServer.trees.set('t-quitada', { id: 't-quitada', foto_url: null });
  // Ya remota: no hay nada que liberar.
  await arbol('t-remota', 'org/p-1/t-remota.jpg', true);
});

describe('Liberar espacio (#565)', () => {
  it('el resumen cuenta solo lo descargado y avisa las sin subir, sin conexión', async () => {
    mockServer.falla = true;
    expect(await resumenDeEspacio()).toEqual({ fotos: 2, bytes: 2000, sinSubir: 1 });
  });

  it('libera solo lo que el server confirma y deja la fila apuntando a Storage', async () => {
    const plan = await prepararLiberacion();
    expect(plan.fotos.map((f) => f.id)).toEqual(['t-bajada']);
    expect(plan).toMatchObject({ bytes: 1000, sinSubir: 1, sinConfirmar: 1 });

    expect(await liberarEspacio(plan)).toEqual({ fotos: 1, bytes: 1000 });

    expect(await fotoDe('t-bajada')).toEqual({ fotoUrl: 'org/p-1/t-bajada.jpg', fotoSynced: true });
    expect(borrarFotosLocales).toHaveBeenCalledWith([`${CARPETA}photo_t-bajada.jpg`]);
  });

  it('nunca toca una foto sin subir, ni el server, ni borrados_pendientes', async () => {
    await liberarEspacio(await prepararLiberacion());

    expect(await fotoDe('t-pendiente')).toEqual({ fotoUrl: `${CARPETA}photo_t-pendiente.jpg`, fotoSynced: false });
    expect(await fotoDe('t-quitada')).toEqual({ fotoUrl: `${CARPETA}photo_t-quitada.jpg`, fotoSynced: true });
    expect(await mockTestDb.select().from(borradosPendientes)).toEqual([]);
    expect(mockServer.escrituras).toBe(0);
  });

  it('una foto reemplazada entre confirmar y liberar no se borra', async () => {
    const plan = await prepararLiberacion();
    await mockTestDb.update(trees)
      .set({ fotoUrl: `${CARPETA}photo_t-bajada_nueva.jpg`, fotoSynced: false })
      .where(eq(trees.id, 't-bajada'));

    expect(await liberarEspacio(plan)).toEqual({ fotos: 0, bytes: 0 });
    expect(await fotoDe('t-bajada')).toEqual({ fotoUrl: `${CARPETA}photo_t-bajada_nueva.jpg`, fotoSynced: false });
    expect(borrarFotosLocales).toHaveBeenCalledWith([]);
  });

  it('sin conexión no prepara nada', async () => {
    mockServer.falla = true;
    await expect(prepararLiberacion()).rejects.toThrow('Network request failed');
    expect(await fotoDe('t-bajada')).toEqual({ fotoUrl: `${CARPETA}photo_t-bajada.jpg`, fotoSynced: true });
  });
});
