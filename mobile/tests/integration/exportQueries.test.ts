/**
 * Integration tests: exportQueries.getExportRows
 * Real SQLite via better-sqlite3 + drizzle migrations.
 * Covers el nombre de parcela (null si está tombstoned, como en la web), el
 * NOT NULL de groups.parcela_id (migración 0018) y el orden y número del ID Parcial.
 */
import { createTestDb, closeTestDb, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
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
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
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

async function seedTree(groupId: string, especieId: string, posicion: number): Promise<void> {
  await mockTestDb.insert(trees).values({
    id: `t-${groupId}-${posicion}`,
    groupId,
    especieId,
    posicion,
    subId: `P1-G1-PI-${posicion}`,
    fotoUrl: null,
    fotoSynced: false,
    usuarioRegistro: 'u1',
    createdAt: localNow(),
  });
}

describe('exportQueries.getExportRows', () => {
  it('returns parcelaNombre when group has parcelaId (happy path)', async () => {
    const plantation = createTestPlantation({ lugar: 'Campo Test', codigo: 'CT26' });
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
    await seedTree('g-1', especieId, 1);
    await seedTree('g-1', especieId, 2);

    const rows = await getExportRows(plantation.id);

    expect(rows).toHaveLength(2);
    expect(rows[0].parcelaNombre).toBe('Parcela 1');
    expect(rows[0].plantacionLugar).toBe('Campo Test');
    expect(rows[0].lugar).toBe('Campo Test');
    expect(rows[0].grupoNombre).toBe('Linea A');
    expect(rows[1].parcelaNombre).toBe('Parcela 1');
    expect(rows[0].idArbol).toBe('P1-G1-PI-1-CT26');
  });

  it('una parcela tombstoned no filtra su nombre al export (alineado con la web)', async () => {
    const plantation = createTestPlantation({ lugar: 'Campo Test' });
    await mockTestDb.insert(plantations).values(plantation);

    await mockTestDb.insert(parcelas).values({
      id: 'parc-borrada',
      plantacionId: plantation.id,
      nombre: 'Parcela Vieja',
      codigo: 'PV',
      descripcion: null,
      pendingSync: false,
      createdAt: localNow(),
      updatedAt: localNow(),
      deletedAt: localNow(),
    });

    await mockTestDb.insert(groups).values({
      id: 'g-borrada',
      plantacionId: plantation.id,
      parcelaId: 'parc-borrada',
      nombre: 'Linea Z',
      codigo: 'LZ',
      tipo: 'linea',
      estado: 'activa',
      usuarioCreador: 'u1',
      createdAt: localNow(),
      pendingSync: false,
    });

    const especieId = await seedSpecies('PI');
    await seedTree('g-borrada', especieId, 1);

    const rows = await getExportRows(plantation.id);

    // El árbol sigue en la planilla; lo que desaparece es el nombre de la parcela.
    expect(rows).toHaveLength(1);
    expect(rows[0].parcelaNombre).toBeNull();
    expect(rows[0].grupoNombre).toBe('Linea Z');
  });

  it('el schema rechaza un grupo sin parcela (NOT NULL, #90 / migración 0018)', async () => {
    // DB propia y fresca: evita flakes por estado compartido con otros tests.
    const propia = createTestDb();
    try {
      const columnas = propia.sqlite
        .prepare('PRAGMA table_info(groups)')
        .all() as { name: string; notnull: number }[];
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
        console.error('DIAG insert-null-resuelto:', JSON.stringify(filas));
      }
      expect(String(error)).toMatch(/NOT NULL/);
    } finally {
      closeTestDb(propia.sqlite);
    }
  });

  it('numera el ID Parcial por alta del grupo y posición, como la web (#822)', async () => {
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

    // El grupo nuevo se inserta primero, y como texto su alta va antes que la del
    // viejo; como instante va después (09:30-03:00 = 12:30Z).
    const grupo = (id: string, createdAt: string) => ({
      id,
      plantacionId: plantation.id,
      parcelaId: 'parc-2',
      nombre: id,
      codigo: id.toUpperCase(),
      tipo: 'linea' as const,
      estado: 'activa' as const,
      usuarioCreador: 'u1',
      createdAt,
      pendingSync: false,
    });
    await mockTestDb.insert(groups).values(grupo('g-nuevo', '2026-03-01T09:30:00.000-03:00'));
    await mockTestDb.insert(groups).values(grupo('g-viejo', '2026-03-01T12:00:00.123456+00:00'));

    const especieId = await seedSpecies('OL');
    await seedTree('g-nuevo', especieId, 1);
    await seedTree('g-viejo', especieId, 2);
    await seedTree('g-viejo', especieId, 1);

    const rows = await getExportRows(plantation.id);

    expect(rows.map((r) => [r.grupoNombre, r.idParcial])).toEqual([
      ['g-viejo', 1],
      ['g-viejo', 2],
      ['g-nuevo', 3],
    ]);
  });

  it('sin código de plantación todavía (no bajó del servidor), el ID de árbol es el SubID', async () => {
    const plantacionId = await seedPlantationWithGroup('Sin Código');
    await seedTree(`g-${plantacionId}`, await seedSpecies('SC'), 1);

    const [fila] = await getExportRows(plantacionId);

    expect(fila.idArbol).toBe('P1-G1-PI-1');
  });

  // ─── LEFT JOIN a species: el árbol nunca debe perderse (antes el INNER JOIN
  // descartaba en silencio árboles con especie null/huérfana). Con FKs activas
  // un huérfano no se puede sembrar; el caso null ejercita el mismo JOIN. ─────

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
      usuarioRegistro: 'u1',
      createdAt: localNow(),
    });

    const rows = await getExportRows(plantacionId);

    expect(rows).toHaveLength(1);
    expect(rows[0].idParcial).toBe(1);
    expect(rows[0].especieNombre).toBeNull();
  });
});
