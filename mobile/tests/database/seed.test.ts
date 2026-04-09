import { seedSpeciesIfNeeded } from '../../src/database/seeds/seedSpecies';
import speciesData from '../../assets/species.json';

// Mock the db module
const mockValues = jest.fn();
const mockFrom = jest.fn();
const mockDeleteWhere = jest.fn();
const mockUpdateWhere = jest.fn();
const mockUpdateSet = jest.fn().mockReturnValue({ where: mockUpdateWhere });

const mockDb = {
  select: jest.fn().mockReturnValue({ from: mockFrom }),
  insert: jest.fn().mockReturnValue({ values: mockValues }),
  delete: jest.fn().mockReturnValue({ where: mockDeleteWhere }),
  update: jest.fn().mockReturnValue({ set: mockUpdateSet }),
};

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockDb;
  },
}));

describe('seedSpeciesIfNeeded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-attach chains after clearAllMocks (clearAllMocks resets mock implementations)
    mockDb.select.mockReturnValue({ from: mockFrom });
    mockDb.insert.mockReturnValue({ values: mockValues });
    mockDb.delete.mockReturnValue({ where: mockDeleteWhere });
    mockDb.update.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockDeleteWhere.mockResolvedValue(undefined);
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it('inserts all species when table is empty', async () => {
    mockFrom.mockResolvedValue([]);
    mockValues.mockResolvedValue(undefined);

    await seedSpeciesIfNeeded();

    expect(mockValues).toHaveBeenCalledTimes(1);
    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues).toHaveLength(speciesData.length);
  });

  it('does not insert when species already exist (idempotent)', async () => {
    // Return all existing species matching the catalog
    const existingSpecies = (speciesData as { id: string; codigo: string; nombre: string; nombre_cientifico: string | null }[]).map((s) => ({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      nombreCientifico: s.nombre_cientifico ?? null,
    }));
    mockFrom.mockResolvedValue(existingSpecies);

    await seedSpeciesIfNeeded();

    expect(mockValues).not.toHaveBeenCalled();
  });

  it('each species has required fields: id, codigo, nombre', async () => {
    mockFrom.mockResolvedValue([]);
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
