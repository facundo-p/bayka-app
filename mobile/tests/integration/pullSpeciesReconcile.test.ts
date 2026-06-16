/**
 * Integration tests: pullSpeciesFromServer — reconciliación de especies.
 * SQLite real vía better-sqlite3 + migraciones drizzle.
 *
 * Cubre el escenario B2 del bug de export: el server trae una especie con un
 * `id` distinto al de una fila local que ya usa ese `codigo` (catálogo embebido
 * con id sintético vs. UUID del server). El upsert por id chocaba contra
 * UNIQUE(codigo) y se salteaba → los árboles que apuntaban al id del server
 * quedaban huérfanos y se caían del export. Ahora se reconcilia: se re-apuntan
 * las referencias al id del server y se elimina la fila duplicada (preservando
 * el codigo, así los SubID siguen válidos).
 */
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import {
  createTestPlantation,
  createTestGroup,
  createTestTree,
} from '../helpers/factories';
import {
  species,
  trees,
  plantations,
  groups,
  plantationSpecies,
  userSpeciesOrder,
} from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import { localNow } from '../../src/utils/dateUtils';
import Database from 'better-sqlite3';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

// Filas que "devuelve el server" — mutable por test.
const mockState: { species: any[] } = { species: [] };

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

jest.mock('../../src/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: mockState.species, error: null })),
    })),
  },
}));

import { pullSpeciesFromServer } from '../../src/services/sync/preSteps';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  // Prod (expo-sqlite) no activa PRAGMA foreign_keys → árboles con especieId
  // huérfano pueden existir, que es el estado que reconciliamos.
  sqlite.pragma('foreign_keys = OFF');
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  await mockTestDb.delete(userSpeciesOrder);
  await mockTestDb.delete(plantationSpecies);
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(plantations);
  await mockTestDb.delete(species);
  mockState.species = [];
});

describe('pullSpeciesFromServer — reconciliación por codigo', () => {
  it('re-apunta árbol + plantation_species y elimina la especie local duplicada', async () => {
    const plantation = createTestPlantation();
    await mockTestDb.insert(plantations).values(plantation);
    const group = createTestGroup({ plantacionId: plantation.id });
    await mockTestDb.insert(groups).values(group);

    // Especie local con id sintético y codigo COC.
    const localId = 'a0000000-0000-0000-0000-000000000012';
    await mockTestDb.insert(species).values({
      id: localId, codigo: 'COC', nombre: 'Kokú', nombreCientifico: null, createdAt: localNow(),
    });

    const serverId = 'b1111111-1111-1111-1111-111111111111';
    // T1 apunta al id LOCAL (resuelve hoy) → debe re-apuntarse al server.
    await mockTestDb.insert(trees).values(
      createTestTree({ id: 't1', groupId: group.id, especieId: localId, subId: 'LACOC1', globalId: 6001 }),
    );
    // T2 apunta al id del SERVER (huérfano hoy) → ya resuelve tras reconciliar.
    await mockTestDb.insert(trees).values(
      createTestTree({ id: 't2', groupId: group.id, especieId: serverId, subId: 'LACOC2', globalId: 6002 }),
    );
    // plantation_species y user_species_order del id local.
    await mockTestDb.insert(plantationSpecies).values({
      id: 'ps-1', plantacionId: plantation.id, especieId: localId, ordenVisual: 0,
    });
    await mockTestDb.insert(userSpeciesOrder).values({
      userId: 'u1', plantacionId: plantation.id, especieId: localId, ordenVisual: 3,
    });

    mockState.species = [
      { id: serverId, codigo: 'COC', nombre: 'Kokú', nombre_cientifico: null, created_at: localNow() },
    ];

    await pullSpeciesFromServer();

    // El duplicado local desaparece; sobrevive la fila del server con su codigo.
    const byCodigo = await mockTestDb.select().from(species).where(eq(species.codigo, 'COC'));
    expect(byCodigo).toHaveLength(1);
    expect(byCodigo[0].id).toBe(serverId);
    const oldRow = await mockTestDb.select().from(species).where(eq(species.id, localId));
    expect(oldRow).toHaveLength(0);

    // Ambos árboles resuelven al server id (clave del bug de export).
    const treeRows = await mockTestDb.select().from(trees);
    expect(treeRows.every((t) => t.especieId === serverId)).toBe(true);

    // plantation_species re-apuntado al server id.
    const [ps] = await mockTestDb.select().from(plantationSpecies).where(eq(plantationSpecies.id, 'ps-1'));
    expect(ps.especieId).toBe(serverId);

    // user_species_order del id viejo se borró (orden cosmético).
    const uso = await mockTestDb.select().from(userSpeciesOrder);
    expect(uso).toHaveLength(0);
  });

  it('inserta una especie nueva con codigo único sin tocar el resto', async () => {
    mockState.species = [
      { id: 'c-new', codigo: 'YVY', nombre: 'Yvyra', nombre_cientifico: null, created_at: localNow() },
    ];

    await pullSpeciesFromServer();

    const [row] = await mockTestDb.select().from(species).where(eq(species.codigo, 'YVY'));
    expect(row.id).toBe('c-new');
    expect(row.nombre).toBe('Yvyra');
  });

  it('actualiza por id (mismo id, sin reconciliar) cuando no hay colisión', async () => {
    await mockTestDb.insert(species).values({
      id: 'same-id', codigo: 'COC', nombre: 'Kokú viejo', nombreCientifico: null, createdAt: localNow(),
    });
    mockState.species = [
      { id: 'same-id', codigo: 'COC', nombre: 'Kokú nuevo', nombre_cientifico: 'Coccoloba', created_at: localNow() },
    ];

    await pullSpeciesFromServer();

    const rows = await mockTestDb.select().from(species).where(eq(species.codigo, 'COC'));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('same-id');
    expect(rows[0].nombre).toBe('Kokú nuevo');
    expect(rows[0].nombreCientifico).toBe('Coccoloba');
  });
});
