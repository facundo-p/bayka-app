import { seedSpeciesIfNeeded } from '../../src/database/seeds/seedSpecies';
import speciesData from '../../assets/species.json';

// Mock the db module
const mockValues = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../src/database/client', () => ({
  db: {
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
  },
}));

describe('seedSpeciesIfNeeded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts all species when table is empty', async () => {
    mockFrom.mockResolvedValue([{ count: 0 }]);
    mockValues.mockResolvedValue(undefined);

    await seedSpeciesIfNeeded();

    expect(mockValues).toHaveBeenCalledTimes(1);
    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues).toHaveLength(speciesData.length);
  });

  it('does not insert when species already exist (idempotent)', async () => {
    mockFrom.mockResolvedValue([{ count: speciesData.length }]);

    await seedSpeciesIfNeeded();

    expect(mockValues).not.toHaveBeenCalled();
  });

  it('each species has required fields: id, codigo, nombre', async () => {
    mockFrom.mockResolvedValue([{ count: 0 }]);
    mockValues.mockResolvedValue(undefined);

    await seedSpeciesIfNeeded();

    const insertedValues = mockValues.mock.calls[0][0];
    insertedValues.forEach((s: { id: string; codigo: string; nombre: string }) => {
      expect(s.id).toBeTruthy();
      expect(s.codigo).toBeTruthy();
      expect(s.nombre).toBeTruthy();
    });
  });
});
