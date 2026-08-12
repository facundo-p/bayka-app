/**
 * Integration tests: exportQueries.getExportRows
 * Real SQLite via better-sqlite3 + drizzle migrations.
 *
 * Verifies:
 *  - INNER JOIN a parcelas (#90: parcela obligatoria) → parcelaNombre siempre presente
 *  - El schema rechaza groups sin parcela (NOT NULL, migración 0018)
 *  - Rows ordered by globalId ASC
 * Covers: EXPO-PARC-01, EXPO-PARC-02
 */
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import Database from 'better-sqlite3';
import {
  plantations,
  parcelas,
  groups,
  trees,
  species,
} from '../../src/database/schema';
import { localNow } from '../../src/utils/dateUtils';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { getExportRows } from '../../src/queries/exportQueries';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  // Prod (expo-sqlite) no activa PRAGMA foreign_keys → árboles con especieId
  // huérfano pueden existir. Reproducimos ese estado en el test.
  sqlite.pragma('foreign_keys = OFF');
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(parcelas);
  await mockTestDb.delete(plantations);
  await mockTestDb.delete(species);
});

async function seedSpecies(codigo = 'PI'): Promise<string> {
  const id = `sp-${Math.random().toString(36).slice(2, 8)}`;
  await mockTestDb.insert(species).values({
    id,
    codigo,
    nombre: 'Pino',
    nombreCientifico: null,
    createdAt: localNow(),
  });
  return id;
}

async function seedTree(
  groupId: string,
  especieId: string,
  globalId: number,
  posicion: number,
): Promise<void> {
  await mockTestDb.insert(trees).values({
    id: `t-${globalId}`,
    groupId,
    especieId,
    posicion,
    subId: `P1-G1-PI-${posicion}`,
    fotoUrl: null,
    fotoSynced: false,
    plantacionId: posicion,
    globalId,
    usuarioRegistro: 'u1',
    createdAt: localNow(),
  });
}

describe('exportQueries.getExportRows', () => {
  it('returns parcelaNombre when group has parcelaId (happy path)', async () => {
    const plantation = createTestPlantation({ lugar: 'Campo Test' });
    await mockTestDb.insert(plantations).values(plantation);

    await mockTestDb.insert(parcelas).values({
      id: 'parc-1',
      plantacionId: plantation.id,
      nombre: 'Parcela 1',
      codigo: 'P1',
      descripcion: null,
      pendingSync: false,
      createdAt: localNow(),
      updatedAt: localNow(),
      deletedAt: null,
    });

    await mockTestDb.insert(groups).values({
      id: 'g-1',
      plantacionId: plantation.id,
      parcelaId: 'parc-1',
      nombre: 'Linea A',
      codigo: 'LA',
      tipo: 'linea',
      estado: 'activa',
      usuarioCreador: 'u1',
      createdAt: localNow(),
      pendingSync: false,
    });

    const especieId = await seedSpecies('PI');
    await seedTree('g-1', especieId, 10, 1);
    await seedTree('g-1', especieId, 11, 2);

    const rows = await getExportRows(plantation.id);

    expect(rows).toHaveLength(2);
    expect(rows[0].parcelaNombre).toBe('Parcela 1');
    expect(rows[0].plantacionLugar).toBe('Campo Test');
    expect(rows[0].lugar).toBe('Campo Test');
    expect(rows[0].grupoNombre).toBe('Linea A');
    expect(rows[1].parcelaNombre).toBe('Parcela 1');
  });

  it('el schema rechaza un grupo sin parcela (NOT NULL, #90 / migración 0018)', async () => {
    // DB propia y fresca: valida el resultado de la migración 0018 sin depender
    // del estado compartido del archivo (evita flakes por interferencia).
    const propia = createTestDb();
    try {
      const columnas = propia.sqlite
        .prepare('PRAGMA table_info(groups)')
        .all() as Array<{ name: string; notnull: number }>;
      expect(columnas.find((c) => c.name === 'parcela_id')?.notnull).toBe(1);

      const plantation = createTestPlantation({ lugar: 'Campo Invalido' });
      await propia.db.insert(plantations).values(plantation);
      let error: unknown = null;
      try {
        await propia.db.insert(groups).values({
          id: 'g-sin-parcela',
          plantacionId: plantation.id,
          parcelaId: null,
          nombre: 'Linea Invalida',
          codigo: 'LI',
          tipo: 'linea',
          estado: 'activa',
          usuarioCreador: 'u1',
          createdAt: localNow(),
          pendingSync: false,
        } as unknown as typeof groups.$inferInsert);
      } catch (e) {
        error = e;
      }
      if (error === null) {
        // Diagnóstico del flake: ¿qué quedó insertado realmente?
        const filas = propia.sqlite.prepare('SELECT id, parcela_id FROM groups').all();
        // eslint-disable-next-line no-console
        console.error('DIAG insert-null-resuelto:', JSON.stringify(filas));
      }
      expect(String(error)).toMatch(/NOT NULL/);
    } finally {
      closeTestDb(propia.sqlite);
    }
  });

  it('orders rows by globalId ASC', async () => {
    const plantation = createTestPlantation();
    await mockTestDb.insert(plantations).values(plantation);

    await mockTestDb.insert(parcelas).values({
      id: 'parc-2',
      plantacionId: plantation.id,
      nombre: 'Parcela 1',
      codigo: 'P1',
      descripcion: null,
      pendingSync: false,
      createdAt: localNow(),
      updatedAt: localNow(),
      deletedAt: null,
    });

    await mockTestDb.insert(groups).values({
      id: 'g-2',
      plantacionId: plantation.id,
      parcelaId: 'parc-2',
      nombre: 'G2',
      codigo: 'G2',
      tipo: 'linea',
      estado: 'activa',
      usuarioCreador: 'u1',
      createdAt: localNow(),
      pendingSync: false,
    });

    const especieId = await seedSpecies('OL');
    await seedTree('g-2', especieId, 30, 3);
    await seedTree('g-2', especieId, 10, 1);
    await seedTree('g-2', especieId, 20, 2);

    const rows = await getExportRows(plantation.id);

    expect(rows.map((r) => r.globalId)).toEqual([10, 20, 30]);
  });

  // ─── LEFT JOIN a species: el árbol NUNCA debe perderse ──────────────────────
  // Antes el INNER JOIN descartaba en silencio árboles con especie null/huérfana.

  async function seedPlantationWithGroup(lugar: string): Promise<string> {
    const plantation = createTestPlantation({ lugar });
    await mockTestDb.insert(plantations).values(plantation);
    await mockTestDb.insert(parcelas).values({
      id: `parc-${plantation.id}`,
      plantacionId: plantation.id,
      nombre: 'Parcela X',
      codigo: 'PX',
      descripcion: null,
      pendingSync: false,
      createdAt: localNow(),
      updatedAt: localNow(),
      deletedAt: null,
    });
    await mockTestDb.insert(groups).values({
      id: `g-${plantation.id}`,
      plantacionId: plantation.id,
      parcelaId: `parc-${plantation.id}`,
      nombre: 'Linea X',
      codigo: 'LX',
      tipo: 'linea',
      estado: 'activa',
      usuarioCreador: 'u1',
      createdAt: localNow(),
      pendingSync: false,
    });
    return plantation.id;
  }

  it('incluye el árbol con especieId = null y devuelve especieNombre null', async () => {
    const plantacionId = await seedPlantationWithGroup('Campo NN');
    await mockTestDb.insert(trees).values({
      id: 't-nn',
      groupId: `g-${plantacionId}`,
      especieId: null,
      posicion: 1,
      subId: 'LX-NN-1',
      fotoUrl: null,
      fotoSynced: false,
      plantacionId: 1,
      globalId: 100,
      usuarioRegistro: 'u1',
      createdAt: localNow(),
    });

    const rows = await getExportRows(plantacionId);

    expect(rows).toHaveLength(1);
    expect(rows[0].globalId).toBe(100);
    expect(rows[0].especieNombre).toBeNull();
  });

  it('incluye el árbol con especieId huérfano (especie ausente del catálogo)', async () => {
    const plantacionId = await seedPlantationWithGroup('Campo Huerfano');
    await mockTestDb.insert(trees).values({
      id: 't-orphan',
      groupId: `g-${plantacionId}`,
      especieId: 'especie-inexistente-uuid',
      posicion: 1,
      subId: 'LX-ZZZ-1',
      fotoUrl: null,
      fotoSynced: false,
      plantacionId: 1,
      globalId: 200,
      usuarioRegistro: 'u1',
      createdAt: localNow(),
    });

    const rows = await getExportRows(plantacionId);

    expect(rows).toHaveLength(1);
    expect(rows[0].globalId).toBe(200);
    expect(rows[0].especieNombre).toBeNull();
  });
});
