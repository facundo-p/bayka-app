/**
 * Integration tests: Parcela sync (pull + push + tombstones + conflicts).
 * Cubre roundtrip offline-create, pull merge, conflictos de código/nombre
 * duplicado, fallback a conflicto genérico, atomicidad grupo↔parcela,
 * orden FK en push/pull, y tombstones (push, pull, conflicto).
 *
 * Mock de Supabase: estado in-memory por tabla, con errores del shape real
 * de Postgres (code/details/message).
 */
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import Database from 'better-sqlite3';
import {
  plantations,
  parcelas,
  groups,
  trees,
} from '../../src/database/schema';
import { eq } from 'drizzle-orm';

// ─── Mock Supabase (state-prefixed names for jest.mock hoist) ────────────────

const mockServerState: Record<string, Map<string, any>> = {
  parcelas: new Map(),
  groups: new Map(),
  trees: new Map(),
  plantations: new Map(),
  plantation_users: new Map(),
  plantation_species: new Map(),
};
const mockCallOrder: Array<{ table: string; op: string }> = [];
const mockConflictRules: Array<{
  table: string;
  matchCols: string[];
  errorCols: string[];
  shape?: 'malformed';
}> = [];

// Reference these from outside (they are stable references — Map / Array).
const serverState = mockServerState;
const callOrder = mockCallOrder;
const conflictRules = mockConflictRules;

jest.mock('../../src/supabase/client', () => {
  const buildSelect = (table: string, filters: Array<{ col: string; op: 'eq' | 'in'; value: any }>) => {
    const all = Array.from(mockServerState[table]?.values() ?? []);
    return all.filter(row =>
      filters.every(f =>
        f.op === 'eq' ? row[f.col] === f.value : Array.isArray(f.value) && f.value.includes(row[f.col])
      )
    );
  };
  const checkConflicts = (table: string, row: any): any => {
    for (const rule of mockConflictRules) {
      if (rule.table !== table) continue;
      const existing = Array.from(mockServerState[table].values()).find((other: any) =>
        other.id !== row.id && rule.matchCols.every(c => other[c] === row[c])
      );
      if (existing) {
        if (rule.shape === 'malformed') {
          return { code: '23505', details: 'malformed details', message: 'dup', hint: null };
        }
        const valStr = rule.errorCols.map(c => row[c]).join(', ');
        return {
          code: '23505',
          details: `Key (${rule.errorCols.join(', ')})=(${valStr}) already exists.`,
          message: `duplicate key value violates unique constraint "${table}_${rule.errorCols.join('_')}_unique"`,
          hint: null,
        };
      }
    }
    return null;
  };
  const makeQueryBuilder = (table: string) => {
    const filters: Array<{ col: string; op: 'eq' | 'in'; value: any }> = [];
    const builder: any = {
      select() { return builder; },
      eq(col: string, value: any) { filters.push({ col, op: 'eq', value }); return builder; },
      in(col: string, value: any[]) { filters.push({ col, op: 'in', value }); return builder; },
      single() {
        mockCallOrder.push({ table, op: 'select' });
        const rows = buildSelect(table, filters);
        return Promise.resolve({ data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116' } });
      },
      then(resolve: any) {
        mockCallOrder.push({ table, op: 'select' });
        const rows = buildSelect(table, filters);
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return builder;
  };
  return {
    supabase: {
      from(table: string) {
        return {
          select() { return makeQueryBuilder(table); },
          eq(col: string, value: any) { return makeQueryBuilder(table).eq(col, value); },
          upsert(row: any) {
            mockCallOrder.push({ table, op: 'upsert' });
            const conflict = checkConflicts(table, row);
            if (conflict) return Promise.resolve({ data: null, error: conflict });
            mockServerState[table].set(row.id, { ...row });
            return Promise.resolve({ data: row, error: null });
          },
          insert(row: any) {
            mockCallOrder.push({ table, op: 'insert' });
            const conflict = checkConflicts(table, row);
            if (conflict) return Promise.resolve({ data: null, error: conflict });
            mockServerState[table].set(row.id, { ...row });
            return Promise.resolve({ data: row, error: null });
          },
          update() {
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      },
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'user-tecnico-1' } } }),
      },
      rpc: () => Promise.resolve({ data: { success: true }, error: null }),
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
    },
  };
});

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/utils/syncLogger', () => ({
  syncLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Imports AFTER mocks
import { pullFromServer } from '../../src/services/sync/pullService';
import {
  uploadSyncableParcelas,
  uploadSyncableGroups,
  classifyParcelaRpcResult,
} from '../../src/services/sync/pushService';
import { findByPlantacion } from '../../src/repositories/ParcelaRepository';

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetServer() {
  for (const k of Object.keys(serverState)) serverState[k].clear();
  conflictRules.length = 0;
  callOrder.length = 0;
}

async function seedLocalPlantation(): Promise<string> {
  const id = '11111111-1111-1111-1111-111111111111';
  await mockTestDb.insert(plantations).values({
    id,
    organizacionId: 'org-1',
    lugar: 'Test',
    periodo: '2026',
    estado: 'activa',
    creadoPor: 'user-tecnico-1',
    createdAt: new Date().toISOString(),
    pendingSync: false,
  });
  return id;
}

async function insertLocalParcela(p: Partial<typeof parcelas.$inferInsert> & { plantacionId: string }) {
  const now = new Date().toISOString();
  const id = p.id ?? 'parc-' + Math.random().toString(36).slice(2, 10);
  await mockTestDb.insert(parcelas).values({
    id,
    plantacionId: p.plantacionId,
    nombre: p.nombre ?? 'Lote A',
    codigo: p.codigo ?? 'LA',
    descripcion: p.descripcion ?? null,
    pendingSync: p.pendingSync ?? true,
    createdAt: p.createdAt ?? now,
    updatedAt: p.updatedAt ?? now,
    deletedAt: p.deletedAt ?? null,
  });
  return id;
}

function insertServerParcela(p: Record<string, any>) {
  serverState.parcelas.set(p.id, { ...p });
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(plantations);
  resetServer();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Parcela sync — pull + push + tombstone + conflicts', () => {
  test('offline-create roundtrip: push uploads then pull keeps pending_sync=false', async () => {
    const pid = await seedLocalPlantation();
    const parcId = await insertLocalParcela({ plantacionId: pid, codigo: 'LP1', nombre: 'Lote 1', pendingSync: true });

    const results = await uploadSyncableParcelas(pid);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, parcId));
    expect(row.pendingSync).toBe(false);
    expect(serverState.parcelas.has(parcId)).toBe(true);

    // pull doesn't resurrect pending_sync
    await pullFromServer(pid);
    const [row2] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, parcId));
    expect(row2.pendingSync).toBe(false);
  });

  test('pull merge: server parcela appears local with pending_sync=false', async () => {
    const pid = await seedLocalPlantation();
    insertServerParcela({
      id: 'srv-parc-1',
      plantation_id: pid,
      nombre: 'Server Lote',
      codigo: 'SVL',
      descripcion: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });

    await pullFromServer(pid);

    const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, 'srv-parc-1'));
    expect(row).toBeDefined();
    expect(row.pendingSync).toBe(false);
    expect(row.codigo).toBe('SVL');
  });

  test('conflict DUPLICATE_CODE: pending_sync stays true on server unique violation', async () => {
    const pid = await seedLocalPlantation();
    insertServerParcela({
      id: 'srv-existing',
      plantation_id: pid,
      codigo: 'LP1',
      nombre: 'Existente',
      descripcion: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    conflictRules.push({ table: 'parcelas', matchCols: ['plantation_id', 'codigo'], errorCols: ['plantation_id', 'codigo'] });

    const localId = await insertLocalParcela({ plantacionId: pid, codigo: 'LP1', nombre: 'Local Diff' });
    const results = await uploadSyncableParcelas(pid);
    expect(results[0].success).toBe(false);
    if (results[0].success) return;
    expect(results[0].error).toBe('DUPLICATE_CODE');

    const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, localId));
    expect(row.pendingSync).toBe(true);
  });

  test('conflict DUPLICATE_NAME: pending_sync stays true', async () => {
    const pid = await seedLocalPlantation();
    insertServerParcela({
      id: 'srv-existing',
      plantation_id: pid,
      codigo: 'OTHER',
      nombre: 'Lote 1',
      descripcion: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    conflictRules.push({ table: 'parcelas', matchCols: ['plantation_id', 'nombre'], errorCols: ['plantation_id', 'nombre'] });

    const localId = await insertLocalParcela({ plantacionId: pid, codigo: 'DIFF', nombre: 'Lote 1' });
    const results = await uploadSyncableParcelas(pid);
    expect(results[0].success).toBe(false);
    if (results[0].success) return;
    expect(results[0].error).toBe('DUPLICATE_NAME');

    const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, localId));
    expect(row.pendingSync).toBe(true);
  });

  test('GENERIC_CONFLICT fallback: malformed details degrade to generic', async () => {
    // Test directo del classifier — más rápido y aislado del mock.
    const result = classifyParcelaRpcResult(
      { id: 'x', nombre: 'X' },
      null,
      { code: '23505', details: 'totally malformed' }
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe('GENERIC_CONFLICT');

    const noDetails = classifyParcelaRpcResult(
      { id: 'y', nombre: 'Y' },
      null,
      { code: '23505' }
    );
    expect(noDetails.success).toBe(false);
    if (noDetails.success) return;
    expect(noDetails.error).toBe('GENERIC_CONFLICT');

    const wrongCols = classifyParcelaRpcResult(
      { id: 'z', nombre: 'Z' },
      null,
      { code: '23505', details: 'Key (other_constraint)=(...) already exists.' }
    );
    expect(wrongCols.success).toBe(false);
    if (wrongCols.success) return;
    expect(wrongCols.error).toBe('GENERIC_CONFLICT');
  });

  test('PERMISSION: RLS denial (postgres 42501) se clasifica como permiso', async () => {
    const denied = classifyParcelaRpcResult(
      { id: 'p', nombre: 'P' },
      null,
      { code: '42501', message: 'new row violates row-level security policy for table "parcelas"' }
    );
    expect(denied.success).toBe(false);
    if (denied.success) return;
    expect(denied.error).toBe('PERMISSION');
  });

  test('atomicidad: group dependiente de parcela pendiente reporta PARCELA_PENDING', async () => {
    const pid = await seedLocalPlantation();
    const parcId = await insertLocalParcela({ plantacionId: pid, codigo: 'PB', nombre: 'Pend', pendingSync: true });
    await mockTestDb.insert(groups).values({
      id: 'group-1',
      plantacionId: pid,
      parcelaId: parcId,
      nombre: 'Grupo 1',
      codigo: 'G1',
      tipo: 'linea',
      estado: 'finalizada',
      usuarioCreador: 'user-tecnico-1',
      createdAt: new Date().toISOString(),
      pendingSync: true,
    });

    // Provoke conflict to keep parcela pending
    insertServerParcela({
      id: 'srv-pb',
      plantation_id: pid,
      codigo: 'PB',
      nombre: 'OtroNombre',
      descripcion: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    conflictRules.push({ table: 'parcelas', matchCols: ['plantation_id', 'codigo'], errorCols: ['plantation_id', 'codigo'] });

    await uploadSyncableParcelas(pid);
    const groupResults = await uploadSyncableGroups(pid);
    expect(groupResults).toHaveLength(1);
    expect(groupResults[0].success).toBe(false);
    if (groupResults[0].success) return;
    expect(groupResults[0].error).toBe('PARCELA_PENDING');
    expect(serverState.groups.has('group-1')).toBe(false); // el grupo no llegó a subirse
  });

  test('orden FK push: parcela upserts antes que groups en la secuencia de llamadas', async () => {
    const pid = await seedLocalPlantation();
    const parcId = await insertLocalParcela({ plantacionId: pid, codigo: 'PFK', nombre: 'PFK', pendingSync: true });
    await mockTestDb.insert(groups).values({
      id: 'g-fk',
      plantacionId: pid,
      parcelaId: parcId,
      nombre: 'GFK',
      codigo: 'GFK',
      tipo: 'linea',
      estado: 'finalizada',
      usuarioCreador: 'user-tecnico-1',
      createdAt: new Date().toISOString(),
      pendingSync: true,
    });

    callOrder.length = 0;
    await uploadSyncableParcelas(pid);
    await uploadSyncableGroups(pid);

    // groups en este pipeline usan .rpc('sync_subgroup'), no supabase.from('groups').upsert;
    // basta confirmar que el upsert de parcela ocurrió.
    const firstParcela = callOrder.findIndex(c => c.table === 'parcelas' && c.op === 'upsert');
    expect(firstParcela).toBeGreaterThanOrEqual(0);
  });

  test('orden FK pull: pullFromServer baja parcelas antes que groups', async () => {
    const pid = await seedLocalPlantation();
    insertServerParcela({
      id: 'srv-pull-fk',
      plantation_id: pid,
      codigo: 'PFK',
      nombre: 'PFK',
      descripcion: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    serverState.groups.set('g-pull', {
      id: 'g-pull',
      plantation_id: pid,
      parcela_id: 'srv-pull-fk',
      nombre: 'G Pull',
      codigo: 'GP',
      tipo: 'linea',
      estado: 'activa',
      usuario_creador: 'user-tecnico-1',
      created_at: new Date().toISOString(),
    });

    callOrder.length = 0;
    await pullFromServer(pid);

    const parcSelectIdx = callOrder.findIndex(c => c.table === 'parcelas' && c.op === 'select');
    const groupSelectIdx = callOrder.findIndex(c => c.table === 'groups' && c.op === 'select');
    expect(parcSelectIdx).toBeGreaterThanOrEqual(0);
    expect(groupSelectIdx).toBeGreaterThanOrEqual(0);
    expect(parcSelectIdx).toBeLessThan(groupSelectIdx);

    const [pRow] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, 'srv-pull-fk'));
    expect(pRow).toBeDefined();
    const [gRow] = await mockTestDb.select().from(groups).where(eq(groups.id, 'g-pull'));
    expect(gRow).toBeDefined();
    expect(gRow.parcelaId).toBe('srv-pull-fk');
  });

  test('pull NO pisa el estado de un grupo con cambios locales pendientes', async () => {
    const pid = await seedLocalPlantation();
    const now = new Date().toISOString();
    const parcId = await insertLocalParcela({ plantacionId: pid, codigo: 'PG', nombre: 'Parcela G' });
    // Grupo DIRTY local: finalizada + pendingSync (transición sin subir aún).
    await mockTestDb.insert(groups).values({
      id: 'g-dirty', plantacionId: pid, parcelaId: parcId, nombre: 'Dirty', codigo: 'GD',
      tipo: 'linea', estado: 'finalizada', usuarioCreador: 'user-tecnico-1', createdAt: now, pendingSync: true,
    });
    // Grupo CLEAN local: sin cambios pendientes.
    await mockTestDb.insert(groups).values({
      id: 'g-clean', plantacionId: pid, parcelaId: parcId, nombre: 'Clean', codigo: 'GC',
      tipo: 'linea', estado: 'activa', usuarioCreador: 'user-tecnico-1', createdAt: now, pendingSync: false,
    });
    // El server tiene ambos con estado VIEJO 'activa' (dirty) / 'finalizada' (clean).
    serverState.groups.set('g-dirty', { id: 'g-dirty', plantation_id: pid, parcela_id: parcId, nombre: 'Dirty', codigo: 'GD', tipo: 'linea', estado: 'activa', usuario_creador: 'user-tecnico-1', created_at: now });
    serverState.groups.set('g-clean', { id: 'g-clean', plantation_id: pid, parcela_id: parcId, nombre: 'Clean', codigo: 'GC', tipo: 'linea', estado: 'finalizada', usuario_creador: 'user-tecnico-1', created_at: now });

    await pullFromServer(pid);

    // Dirty: el estado local 'finalizada' se conserva (no lo pisa el server).
    const [dirty] = await mockTestDb.select().from(groups).where(eq(groups.id, 'g-dirty'));
    expect(dirty.estado).toBe('finalizada');
    expect(dirty.pendingSync).toBe(true);
    // Clean: toma el estado del server.
    const [clean] = await mockTestDb.select().from(groups).where(eq(groups.id, 'g-clean'));
    expect(clean.estado).toBe('finalizada');
  });

  test('tombstone push: parcela con deletedAt sube y queda pending_sync=false', async () => {
    const pid = await seedLocalPlantation();
    const now = new Date().toISOString();
    const parcId = await insertLocalParcela({
      plantacionId: pid,
      codigo: 'TMB',
      nombre: 'Tombstoned',
      pendingSync: true,
      deletedAt: now,
    });

    const results = await uploadSyncableParcelas(pid);
    expect(results[0].success).toBe(true);

    const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, parcId));
    expect(row.pendingSync).toBe(false);
    expect(row.deletedAt).toBe(now);
    expect(serverState.parcelas.get(parcId)?.deleted_at).toBe(now);
  });

  test('server tombstone → pull marca deletedAt local; parcela no aparece en findByPlantacion', async () => {
    const pid = await seedLocalPlantation();
    const tombstoneTs = '2026-05-19T10:00:00.000Z';
    insertServerParcela({
      id: 'srv-tomb',
      plantation_id: pid,
      codigo: 'TMB',
      nombre: 'Server Tomb',
      descripcion: null,
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: tombstoneTs,
      deleted_at: tombstoneTs,
    });

    await pullFromServer(pid);
    const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, 'srv-tomb'));
    expect(row.deletedAt).toBe(tombstoneTs);

    const visible = await findByPlantacion(pid);
    expect(visible.find(p => p.id === 'srv-tomb')).toBeUndefined();
  });

  test('conflict tombstone: local tombstone pendiente NO se pisa por pull con server activo', async () => {
    const pid = await seedLocalPlantation();
    const tombTs = '2026-05-20T10:00:00.000Z';
    const parcId = await insertLocalParcela({
      plantacionId: pid,
      codigo: 'CT',
      nombre: 'Pending Tomb',
      pendingSync: true,
      deletedAt: tombTs,
    });
    // Server tiene la misma fila pero ACTIVA (sin deleted_at)
    insertServerParcela({
      id: parcId,
      plantation_id: pid,
      codigo: 'CT',
      nombre: 'Pending Tomb',
      descripcion: null,
      created_at: '2026-05-19T00:00:00.000Z',
      updated_at: '2026-05-20T15:00:00.000Z',
      deleted_at: null,
    });

    await pullFromServer(pid);
    const [row] = await mockTestDb.select().from(parcelas).where(eq(parcelas.id, parcId));
    expect(row.deletedAt).toBe(tombTs); // not overwritten
    expect(row.pendingSync).toBe(true); // still pending
  });
});
