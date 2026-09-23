/**
 * `seedSpeciesIfNeeded` corre en cada arranque y quita del catálogo local lo que
 * ya no está en `assets/species.json`. Una especie que bajó del server y el JSON
 * no tiene, o que salió del JSON, puede tener árboles apuntándole: borrarla deja
 * esas referencias colgadas (#614).
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createTestDb, closeTestDb, IntegrationDb } from '../helpers/integrationDb';
import { createTestPlantation, createTestGroup, createTestTree } from '../helpers/factories';
import {
  species, trees, groups, plantations, plantationSpecies, userSpeciesOrder,
} from '../../src/database/schema';
import speciesData from '../../assets/species.json';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { seedSpeciesIfNeeded } from '../../src/database/seeds/seedSpecies';

const PLANTACION_ID = 'plant-1';
const GRUPO_ID = 'g-1';

const especieFueraDelCatalogo = (id: string, codigo: string) => ({
  id, codigo, nombre: `Especie ${codigo}`, nombreCientifico: null, createdAt: '2026-01-01T00:00:00',
});

const existe = async (id: string) =>
  (await mockTestDb.select().from(species).where(eq(species.id, id))).length === 1;

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
  // Como en producción: sin FKs el borrado no falla, deja la referencia colgada.
  sqlite.pragma('foreign_keys = OFF');
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await mockTestDb.delete(userSpeciesOrder);
  await mockTestDb.delete(plantationSpecies);
  await mockTestDb.delete(trees);
  await mockTestDb.delete(groups);
  await mockTestDb.delete(plantations);
  await mockTestDb.delete(species);
  await mockTestDb.insert(plantations).values(createTestPlantation({ id: PLANTACION_ID }));
  await mockTestDb.insert(groups).values(createTestGroup({ id: GRUPO_ID, plantacionId: PLANTACION_ID }));
  // Catálogo ya sembrado: el seed entra por la rama de sincronización.
  await seedSpeciesIfNeeded();
});

describe('seedSpeciesIfNeeded — especies fuera del catálogo local', () => {
  it('conserva una especie usada por un árbol', async () => {
    await mockTestDb.insert(species).values(especieFueraDelCatalogo('sp-server', 'SRV'));
    await mockTestDb.insert(trees).values(createTestTree({ id: 't1', groupId: GRUPO_ID, especieId: 'sp-server' }));

    await seedSpeciesIfNeeded();

    expect(await existe('sp-server')).toBe(true);
  });

  it('conserva una especie usada solo por plantation_species', async () => {
    await mockTestDb.insert(species).values(especieFueraDelCatalogo('sp-server', 'SRV'));
    await mockTestDb.insert(plantationSpecies).values({
      id: 'ps-1', plantacionId: PLANTACION_ID, especieId: 'sp-server', ordenVisual: 0,
    });

    await seedSpeciesIfNeeded();

    expect(await existe('sp-server')).toBe(true);
  });

  it('conserva una especie usada solo por user_species_order', async () => {
    await mockTestDb.insert(species).values(especieFueraDelCatalogo('sp-server', 'SRV'));
    await mockTestDb.insert(userSpeciesOrder).values({
      userId: 'u1', plantacionId: PLANTACION_ID, especieId: 'sp-server', ordenVisual: 0,
    });

    await seedSpeciesIfNeeded();

    expect(await existe('sp-server')).toBe(true);
  });

  it('borra una especie fuera del catálogo que nadie referencia', async () => {
    await mockTestDb.insert(species).values(especieFueraDelCatalogo('sp-vieja', 'OLD'));

    await seedSpeciesIfNeeded();

    expect(await existe('sp-vieja')).toBe(false);
    expect(await mockTestDb.select().from(species)).toHaveLength(speciesData.length);
  });
});
