/**
 * Integración: purga de filas huérfanas (issue #71, causa raíz del naranja
 * permanente). SQLite real con las migraciones drizzle.
 *
 * Las huérfanas se siembran con PRAGMA foreign_keys=OFF, que es el estado
 * REAL del cliente en el device (client.ts nunca activa FKs): así se
 * generaron los residuos pre-#90 que la purga limpia.
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { plantations, parcelas, groups, trees } from '../../src/database/schema';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { purgeOrphanRows } from '../../src/services/sync/orphanCleanup';

const NOW = '2026-08-13T00:00:00Z';

async function seedSanos() {
  await mockTestDb.insert(plantations).values({
    id: 'p1', organizacionId: 'org-1', lugar: 'Campo Sano', periodo: '2026',
    estado: 'activa', creadoPor: 'user-1', createdAt: NOW, pendingSync: false,
  });
  await mockTestDb.insert(parcelas).values({
    id: 'parc-sana', plantacionId: 'p1', nombre: 'Parcela 1', codigo: 'P1',
    pendingSync: true, createdAt: NOW, updatedAt: NOW,
  });
  await mockTestDb.insert(groups).values({
    id: 'g-sano', plantacionId: 'p1', parcelaId: 'parc-sana', nombre: 'G1',
    codigo: 'G1', usuarioCreador: 'user-1', createdAt: NOW, pendingSync: true,
  });
  await mockTestDb.insert(trees).values({
    id: 't-sano', groupId: 'g-sano', posicion: 1, subId: 'G1-1',
    usuarioRegistro: 'user-1', createdAt: NOW,
  });
}

function seedHuerfanos() {
  // Estado real del device: FKs apagadas → residuos posibles.
  sqlite.pragma('foreign_keys = OFF');
  sqlite.prepare(
    `INSERT INTO parcelas (id, plantacion_id, nombre, codigo, pending_sync, created_at, updated_at, deleted_at)
     VALUES ('parc-huerfana', 'p-borrada', 'Vieja', 'PX', 1, ?, ?, ?)`
  ).run(NOW, NOW, NOW);
  sqlite.prepare(
    `INSERT INTO groups (id, plantacion_id, parcela_id, nombre, codigo, usuario_creador, created_at, pending_sync)
     VALUES ('g-huerfano', 'p-borrada', 'parc-huerfana', 'GX', 'GX', 'user-1', ?, 1)`
  ).run(NOW);
  sqlite.prepare(
    `INSERT INTO trees (id, group_id, posicion, sub_id, usuario_registro, created_at)
     VALUES ('t-de-grupo-huerfano', 'g-huerfano', 1, 'GX-1', 'user-1', ?)`
  ).run(NOW);
  sqlite.prepare(
    `INSERT INTO trees (id, group_id, posicion, sub_id, usuario_registro, created_at)
     VALUES ('t-sin-grupo', 'g-inexistente', 1, 'ZZ-1', 'user-1', ?)`
  ).run(NOW);
}

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

describe('purgeOrphanRows', () => {
  test('elimina solo las filas huérfanas y reporta los conteos', async () => {
    await seedSanos();
    seedHuerfanos();

    const result = await purgeOrphanRows();

    expect(result).toEqual({ groups: 1, trees: 2, parcelas: 1 });

    // Huérfanos eliminados.
    expect(await mockTestDb.select().from(parcelas).where(eq(parcelas.id, 'parc-huerfana'))).toHaveLength(0);
    expect(await mockTestDb.select().from(groups).where(eq(groups.id, 'g-huerfano'))).toHaveLength(0);
    expect(await mockTestDb.select().from(trees).where(eq(trees.id, 't-de-grupo-huerfano'))).toHaveLength(0);
    expect(await mockTestDb.select().from(trees).where(eq(trees.id, 't-sin-grupo'))).toHaveLength(0);

    // Los datos alcanzables quedan intactos (incluso con pendingSync=true).
    expect(await mockTestDb.select().from(parcelas).where(eq(parcelas.id, 'parc-sana'))).toHaveLength(1);
    expect(await mockTestDb.select().from(groups).where(eq(groups.id, 'g-sano'))).toHaveLength(1);
    expect(await mockTestDb.select().from(trees).where(eq(trees.id, 't-sano'))).toHaveLength(1);
  });

  test('sin huérfanos es un no-op que reporta ceros', async () => {
    const result = await purgeOrphanRows();
    expect(result).toEqual({ groups: 0, trees: 0, parcelas: 0 });
  });
});
