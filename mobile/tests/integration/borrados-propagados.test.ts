/**
 * Integration tests de la propagación de borrados (#467), contra SQLite real.
 *
 * El bug: borrar un árbol o un grupo solo borraba en SQLite. El pull upserteaba de
 * vuelta la fila del server en la MISMA sincronización —corre antes del push— y la
 * renumeración terminaba dejando dos árboles con el mismo SubID, que después subían.
 *
 * Mock de Supabase: estado in-memory por tabla, con un `rpc` que borra de verdad
 * para poder seguir el borrado de punta a punta.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, sqliteDeIntegracion, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import { plantations, parcelas, groups, trees, species } from '../../src/database/schema';

const mockServerState: Record<string, Map<string, any>> = {
  plantations: new Map(),
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
};
const serverState = mockServerState;

jest.mock('../../src/supabase/client', () => {
  const filtrar = (tabla: string, filtros: Array<{ col: string; op: string; value: any }>) =>
    Array.from(mockServerState[tabla]?.values() ?? []).filter((fila: any) =>
      filtros.every((f) =>
        f.op === 'eq' ? fila[f.col] === f.value : Array.isArray(f.value) && f.value.includes(fila[f.col]),
      ),
    );

  const builder = (tabla: string) => {
    const filtros: Array<{ col: string; op: string; value: any }> = [];
    const api: any = {
      select() { return api; },
      eq(col: string, value: any) { filtros.push({ col, op: 'eq', value }); return api; },
      in(col: string, value: any[]) { filtros.push({ col, op: 'in', value }); return api; },
      single() {
        const filas = filtrar(tabla, filtros);
        return Promise.resolve({ data: filas[0] ?? null, error: filas[0] ? null : { code: 'PGRST116' } });
      },
      then(resolver: any) {
        return Promise.resolve({ data: filtrar(tabla, filtros), error: null }).then(resolver);
      },
    };
    return api;
  };

  return {
    supabase: {
      from: (tabla: string) => ({ select: () => builder(tabla) }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-tecnico-1' } } } }),
      },
      // Doble de `sincronizar_borrados`: borra por id, como la función SQL, y
      // rechaza las filas de una plantación finalizada devolviendo sus ids (#469).
      rpc: (nombre: string, args: any) => {
        if (nombre !== 'sincronizar_borrados') return Promise.resolve({ data: null, error: { message: `rpc ${nombre} no mockeado` } });
        if (mockRpcFalla.activo) return Promise.resolve({ data: null, error: { message: 'Network request failed' } });

        // Un id que no existe en el server NO es un rechazo: no hay nada que borrar.
        const escribible = (grupoId: string | undefined) => {
          const grupo = grupoId ? mockServerState.groups.get(grupoId) : undefined;
          const plantacion = grupo ? mockServerState.plantations.get(grupo.plantation_id) : undefined;
          return plantacion?.estado !== 'finalizada';
        };

        let arboles = 0;
        let grupos = 0;
        const rechazados: string[] = [];
        for (const b of args.p_borrados as Array<{ id: string; tipo: string }>) {
          if (b.tipo === 'arbol') {
            const arbol = mockServerState.trees.get(b.id);
            if (!arbol) continue;
            if (!escribible(arbol.group_id)) { rechazados.push(b.id); continue; }
            mockServerState.trees.delete(b.id);
            arboles++;
          }
          if (b.tipo === 'grupo') {
            if (!mockServerState.groups.has(b.id)) continue;
            if (!escribible(b.id)) { rechazados.push(b.id); continue; }
            mockServerState.groups.delete(b.id);
            grupos++;
            // Cascada: trees_group_id_fkey ON DELETE CASCADE.
            for (const [id, t] of mockServerState.trees) if (t.group_id === b.id) mockServerState.trees.delete(id);
          }
        }
        return Promise.resolve({ data: { success: true, arboles, grupos, rechazados }, error: null });
      },
    },
  };
});

const mockRpcFalla = { activo: false };
const rpcFalla = mockRpcFalla;

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

jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` }));
jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { pullFromServer } from '../../src/services/sync/pullService';
import { pushBorrados } from '../../src/services/sync/pushService';
import { deleteLastTree, deleteTreeAndRecalculate } from '../../src/repositories/TreeRepository';
import { deleteGroup } from '../../src/repositories/GroupRepository';
import { deletePlantationLocally } from '../../src/repositories/PlantationRepository';
import { borradosPendientes } from '../../src/database/schema';

const PLANTACION_ID = 'plant-1';
const GRUPO_ID = 'g-1';
const ROBLE = 'sp-roble';
const PINO = 'sp-pino';

/** SQL efectivamente ejecutado, para contar statements. Drizzle cachea el `prepare`, así que se instrumenta la ejecución. */
function registrarSql(conexion: InstanceType<typeof Database>): string[] {
  const ejecutadas: string[] = [];
  const prepareOriginal = conexion.prepare.bind(conexion);
  (conexion as any).prepare = (sentencia: string) => {
    const stmt: any = prepareOriginal(sentencia);
    for (const metodo of ['all', 'get', 'run'] as const) {
      const original = stmt[metodo].bind(stmt);
      stmt[metodo] = (...args: any[]) => {
        ejecutadas.push(sentencia);
        return original(...args);
      };
    }
    return stmt;
  };
  return ejecutadas;
}

const arbolDelServer = (id: string, speciesId: string | null) => ({
  id,
  group_id: GRUPO_ID,
  species_id: speciesId,
  posicion: 1,
  sub_id: `${id}-sub`,
  foto_url: null,
  usuario_registro: 'user-tecnico-1',
  created_at: '2026-01-01T00:00:00',
});

const arbolLocal = (id: string, especieId: string | null) => ({
  id,
  groupId: GRUPO_ID,
  especieId,
  posicion: 1,
  subId: `${id}-sub`,
  fotoUrl: null,
  fotoSynced: false,
  usuarioRegistro: 'user-tecnico-1',
  createdAt: '2026-01-01T00:00:00',
});

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  mockSqliteDeIntegracion = sqliteDeIntegracion(sqlite);
  sqlite.pragma('foreign_keys = OFF');
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  for (const tabla of Object.values(serverState)) tabla.clear();
  rpcFalla.activo = false;
  await mockTestDb.delete(borradosPendientes);

  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(species);
  await mockTestDb.delete(plantations);

  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION_ID, lugar: 'Campo', periodo: '2026' }));
  await mockTestDb.insert(species).values([
    { id: ROBLE, codigo: 'ROB', nombre: 'Roble', nombreCientifico: null, createdAt: '2026-01-01T00:00:00' },
    { id: PINO, codigo: 'PIN', nombre: 'Pino', nombreCientifico: null, createdAt: '2026-01-01T00:00:00' },
  ]);
  await mockTestDb.insert(parcelas).values({
    id: 'parc-1', plantacionId: PLANTACION_ID, nombre: 'Norte', codigo: 'P1', descripcion: null,
    pendingSync: false, createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', deletedAt: null,
  });
  await mockTestDb.insert(groups).values({
    id: GRUPO_ID, plantacionId: PLANTACION_ID, parcelaId: 'parc-1', nombre: 'Linea A', codigo: 'LA',
    tipo: 'linea', estado: 'activa', usuarioCreador: 'user-tecnico-1', createdAt: '2026-01-01T00:00:00', pendingSync: false,
  });

  serverState.plantations.set(PLANTACION_ID, {
    id: PLANTACION_ID, lugar: 'Campo', periodo: '2026', estado: 'activa',
    creado_por: 'admin-1', created_at: '2026-01-01T00:00:00', visible_in_app: true,
  });
  serverState.plantation_users.set('user-tecnico-1', { plantation_id: PLANTACION_ID, user_id: 'user-tecnico-1', rol_en_plantacion: 'tecnico', assigned_at: '2026-01-01T00:00:00' });
  serverState.parcelas.set('parc-1', {
    id: 'parc-1', plantation_id: PLANTACION_ID, nombre: 'Norte', codigo: 'P1', descripcion: null,
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00', deleted_at: null,
  });
  serverState.groups.set(GRUPO_ID, {
    id: GRUPO_ID, plantation_id: PLANTACION_ID, parcela_id: 'parc-1', nombre: 'Linea A', codigo: 'LA',
    tipo: 'linea', estado: 'activa', usuario_creador: 'user-tecnico-1', created_at: '2026-01-01T00:00:00',
  });
});

const leerArbol = async (id: string) => (await mockTestDb.select().from(trees).where(eq(trees.id, id)))[0];
const arbolesDelGrupo = async () => mockTestDb.select().from(trees).where(eq(trees.groupId, GRUPO_ID)).orderBy(trees.posicion);

/**
 * El orden de producción: `correrSyncPlantation` hace el pull ANTES del push. Los
 * tests tienen que respetarlo — con el orden invertido, un grupo borrado parecía
 * resolverse y en realidad el pull lo resucitaba local.
 */
async function sincronizar() {
  await pullFromServer(PLANTACION_ID);
  await pushBorrados(PLANTACION_ID);
}

/** Grupo de 3 árboles ya sincronizado: existen local Y en el server. */
async function grupoSincronizadoDeTres() {
  for (const i of [1, 2, 3]) {
    await mockTestDb.insert(trees).values({ ...arbolLocal(`t${i}`, ROBLE), posicion: i, subId: `P1LA-ROB-${i}` });
    serverState.trees.set(`t${i}`, { ...arbolDelServer(`t${i}`, ROBLE), posicion: i, sub_id: `P1LA-ROB-${i}` });
  }
  await mockTestDb.update(groups).set({ pendingSync: false }).where(eq(groups.id, GRUPO_ID));
}

describe('borrar un árbol de un grupo sincronizado (#467)', () => {
  it('el pull ya no lo resucita', async () => {
    await grupoSincronizadoDeTres();

    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t2')).toBeUndefined();
  });

  // Lo que hacía el bug tan dañino: el SubID es el identificador que el técnico usa
  // en el campo, y quedaban dos árboles con el mismo.
  it('no quedan SubIDs duplicados ni posiciones revertidas', async () => {
    await grupoSincronizadoDeTres();

    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await pullFromServer(PLANTACION_ID);

    const filas = await arbolesDelGrupo();
    expect(filas.map((f) => f.id)).toEqual(['t1', 't3']);
    expect(filas.map((f) => f.posicion)).toEqual([1, 2]);
    expect(new Set(filas.map((f) => f.subId)).size).toBe(2);
  });

  it('el push lo borra del server', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');

    await sincronizar();

    expect(serverState.trees.has('t2')).toBe(false);
    expect(await mockTestDb.select().from(borradosPendientes)).toEqual([]);
  });

  // El camino de borrado más usado: deshacer el último árbol cargado.
  it('deshacer el último árbol también se propaga', async () => {
    await grupoSincronizadoDeTres();

    await deleteLastTree(GRUPO_ID);
    await sincronizar();

    expect(await leerArbol('t3')).toBeUndefined();
    expect(serverState.trees.has('t3')).toBe(false);
  });

  // Si el registro se limpiara sin confirmación, el borrado se perdería para siempre.
  it('un push que falla deja el borrado anotado para el próximo intento', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    rpcFalla.activo = true;

    await sincronizar();

    expect(serverState.trees.has('t2')).toBe(true);
    expect(await mockTestDb.select().from(borradosPendientes)).toHaveLength(1);
    // Y el pull no lo resucitó mientras tanto.
    expect(await leerArbol('t2')).toBeUndefined();

    rpcFalla.activo = false;
    await sincronizar();
    expect(serverState.trees.has('t2')).toBe(false);
  });

  // El registro baja la marca del grupo recién con el push del grupo; sin excluir
  // por id, la sincronización siguiente resucitaba igual.
  it('sigue sin volver después de que el grupo deja de estar pendiente', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await mockTestDb.update(groups).set({ pendingSync: false }).where(eq(groups.id, GRUPO_ID));

    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t2')).toBeUndefined();
  });
});

describe('borrar un grupo entero (#467)', () => {
  // El pull corre primero, y la fila local del grupo ya no existe: `pendingSync` no
  // puede protegerlo. Sin excluirlo por id, el pull lo resucita entero —con sus
  // árboles— y el push después lo borra del server, dejando un grupo fantasma que
  // ya no existe en ningún lado más que en el device.
  it('el pull no lo resucita aunque corra antes del push', async () => {
    await grupoSincronizadoDeTres();

    await deleteGroup(GRUPO_ID);
    await sincronizar();

    const [grupo] = await mockTestDb.select().from(groups).where(eq(groups.id, GRUPO_ID));
    expect(grupo).toBeUndefined();
    expect(await arbolesDelGrupo()).toEqual([]);
  });

  it('el push se lo lleva del server, con sus árboles por cascada', async () => {
    await grupoSincronizadoDeTres();

    await deleteGroup(GRUPO_ID);
    await sincronizar();

    expect(serverState.groups.has(GRUPO_ID)).toBe(false);
    expect(serverState.trees.size).toBe(0);
  });

  it('con el push caído tampoco vuelve, y el reintento lo termina de borrar', async () => {
    await grupoSincronizadoDeTres();
    rpcFalla.activo = true;

    await deleteGroup(GRUPO_ID);
    await sincronizar();

    expect(await arbolesDelGrupo()).toEqual([]);
    expect(serverState.groups.has(GRUPO_ID)).toBe(true);

    rpcFalla.activo = false;
    await sincronizar();
    expect(serverState.groups.has(GRUPO_ID)).toBe(false);
  });
});

describe('lo que NO tiene que cambiar', () => {
  // Agregar árboles a un grupo sincronizado siempre anduvo: el guard nuevo no puede
  // romperlo.
  it('un árbol agregado localmente sobrevive al pull', async () => {
    await grupoSincronizadoDeTres();
    await mockTestDb.insert(trees).values({ ...arbolLocal('t-nuevo', ROBLE), posicion: 4, subId: 'P1LA-ROB-4' });
    await mockTestDb.update(groups).set({ pendingSync: true }).where(eq(groups.id, GRUPO_ID));

    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t-nuevo')).toBeDefined();
  });

  // El registro excluye por id, y un árbol nuevo trae id nuevo: no puede quedar
  // escondido por el borrado de otro.
  it('un árbol recreado después del borrado no queda escondido', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');

    await mockTestDb.insert(trees).values({ ...arbolLocal('t-recreado', ROBLE), posicion: 3, subId: 'P1LA-ROB-3' });
    serverState.trees.set('t-recreado', { ...arbolDelServer('t-recreado', ROBLE), posicion: 3, sub_id: 'P1LA-ROB-3' });
    await mockTestDb.update(groups).set({ pendingSync: false }).where(eq(groups.id, GRUPO_ID));

    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t-recreado')).toBeDefined();
    expect(await leerArbol('t2')).toBeUndefined();
  });

  /**
   * Sacar la plantación del device no toca Supabase, así que los borrados anotados
   * se abandonan. Si quedaran, al volver a descargarla el pull escondería esos
   * árboles para siempre.
   */
  it('borrar la plantación local se lleva sus borrados anotados', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    expect(await mockTestDb.select().from(borradosPendientes)).toHaveLength(1);

    await deletePlantationLocally(PLANTACION_ID);

    expect(await mockTestDb.select().from(borradosPendientes)).toEqual([]);
  });

  /**
   * El guard de `pendingSync` protege las ediciones locales, pero no puede frenar la
   * fase entera: mientras el push de un grupo siga fallando, el técnico igual tiene
   * que ver los árboles que cargó otro.
   */
  it('un árbol nuevo del server llega aunque el grupo esté pendiente', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');

    serverState.trees.set('t-de-otro', { ...arbolDelServer('t-de-otro', ROBLE), posicion: 9, sub_id: 'P1LA-ROB-9' });
    await pullFromServer(PLANTACION_ID);

    expect(await leerArbol('t-de-otro')).toBeDefined();
    // Y lo local sigue protegido.
    expect(await leerArbol('t2')).toBeUndefined();
    expect((await leerArbol('t3')).posicion).toBe(2);
  });

  it('sin nada borrado, el push no llama al server', async () => {
    await grupoSincronizadoDeTres();

    await expect(pushBorrados(PLANTACION_ID)).resolves.toBeUndefined();
    expect(serverState.trees.size).toBe(3);
  });
});

describe('la plantación se finaliza antes de que el borrado llegue (#469)', () => {
  /** El borrado se hizo con la plantación activa; alguien la finalizó después. */
  async function finalizarEnElServer() {
    serverState.plantations.set(PLANTACION_ID, {
      ...serverState.plantations.get(PLANTACION_ID),
      estado: 'finalizada',
    });
  }

  it('el server no borra el árbol', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await finalizarEnElServer();

    await sincronizar();

    expect(serverState.trees.has('t2')).toBe(true);
  });

  // Lo importante: el borrado NO se descarta. Si se reabre la plantación (#470),
  // el próximo sync lo sube.
  it('el borrado queda pendiente en el registro', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await finalizarEnElServer();

    await sincronizar();

    expect(await mockTestDb.select().from(borradosPendientes)).toHaveLength(1);
  });

  it('y el pull sigue sin resucitarlo mientras tanto', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await finalizarEnElServer();

    await sincronizar();
    await sincronizar();

    expect(await leerArbol('t2')).toBeUndefined();
  });

  it('al reabrirse, el mismo borrado se propaga sin intervención', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await finalizarEnElServer();
    await sincronizar();

    serverState.plantations.set(PLANTACION_ID, {
      ...serverState.plantations.get(PLANTACION_ID),
      estado: 'activa',
    });
    await sincronizar();

    expect(serverState.trees.has('t2')).toBe(false);
    expect(await mockTestDb.select().from(borradosPendientes)).toEqual([]);
  });

  // Lote mixto: uno rechazado por la finalización y otro que ya no está en el
  // server. Limpiar por lote —todo o nada— dejaría el segundo pendiente para
  // siempre, y con él el pull escondiendo ese árbol sin fin.
  it('limpia el id que ya no está aunque otro del mismo lote sea rechazado', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    await deleteTreeAndRecalculate('t3', GRUPO_ID, 'LA');
    serverState.trees.delete('t3');
    await finalizarEnElServer();

    await sincronizar();

    const pendientes = await mockTestDb.select().from(borradosPendientes);
    expect(pendientes.map((b: any) => b.id)).toEqual(['t2']);
  });

  // Un id que ya no está en el server no es un rechazo: si quedara pendiente, el
  // registro no se vaciaría nunca y el pull escondería ese árbol para siempre.
  it('un id que ya no está en el server se limpia igual', async () => {
    await grupoSincronizadoDeTres();
    await deleteTreeAndRecalculate('t2', GRUPO_ID, 'LA');
    serverState.trees.delete('t2');

    await sincronizar();

    expect(await mockTestDb.select().from(borradosPendientes)).toEqual([]);
  });
});
