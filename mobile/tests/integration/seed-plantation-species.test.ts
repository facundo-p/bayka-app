/**
 * `seedPlantationSpeciesIfNeeded` corre en cada arranque. En un device que ya
 * tenía plantaciones reales la demo no se siembra, y sus especies quedaban
 * apuntando a una plantación inexistente (#616).
 */
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb, IntegrationDb, vaciarTablas } from '../helpers/integrationDb';
import { createTestPlantation } from '../helpers/factories';
import { plantations, plantationSpecies } from '../../src/database/schema';

let mockTestDb: IntegrationDb;
let sqlite: InstanceType<typeof Database>;

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockTestDb;
  },
}));

import { seedSpeciesIfNeeded } from '../../src/database/seeds/seedSpecies';
import { seedPlantationIfNeeded } from '../../src/database/seeds/seedPlantation';
import { seedPlantationSpeciesIfNeeded } from '../../src/database/seeds/seedPlantationSpecies';

beforeAll(() => {
  const r = createTestDb();
  mockTestDb = r.db;
  sqlite = r.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await vaciarTablas(mockTestDb);
  await seedSpeciesIfNeeded();
});

describe('seedPlantationSpeciesIfNeeded', () => {
  it('siembra las especies de la plantación demo en un device nuevo', async () => {
    await seedPlantationIfNeeded();
    await seedPlantationSpeciesIfNeeded();

    expect((await mockTestDb.select().from(plantationSpecies)).length).toBeGreaterThan(0);
  });

  it('no siembra nada si la demo no está porque el device ya tenía plantaciones', async () => {
    await mockTestDb.insert(plantations).values(createTestPlantation({ id: 'real' }));
    await seedPlantationIfNeeded();

    await expect(seedPlantationSpeciesIfNeeded()).resolves.toBeUndefined();
    expect(await mockTestDb.select().from(plantationSpecies)).toHaveLength(0);
  });
});
