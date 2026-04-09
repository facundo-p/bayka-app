// Tests for PlantationSpeciesRepository — unit tests using mock-based approach
// Covers: getSpeciesForPlantation

jest.mock('../../src/database/client', () => {
  return {
    get db() {
      return mockDb;
    },
  };
});

let mockOrderBy: jest.Mock;
let mockDb: any;

beforeAll(() => {
  mockOrderBy = jest.fn().mockResolvedValue([]);
  mockDb = buildMockDb([]);
});

function buildMockDb(selectResults: any[]) {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        innerJoin: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: mockOrderBy,
          })),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOrderBy = jest.fn().mockResolvedValue([]);
  mockDb = buildMockDb([]);
});

import { getSpeciesForPlantation } from '../../src/repositories/PlantationSpeciesRepository';

describe('PlantationSpeciesRepository', () => {
  describe('getSpeciesForPlantation', () => {
    it('returns species list joined with species table for given plantation', async () => {
      const expectedRows = [
        {
          id: 'ps-1',
          plantacionId: 'plant-1',
          especieId: 'esp-1',
          ordenVisual: 1,
          codigo: 'ANC',
          nombre: 'Anchico',
        },
        {
          id: 'ps-2',
          plantacionId: 'plant-1',
          especieId: 'esp-2',
          ordenVisual: 2,
          codigo: 'EUC',
          nombre: 'Eucalyptus',
        },
      ];
      mockOrderBy.mockResolvedValue(expectedRows);

      const result = await getSpeciesForPlantation('plant-1');

      expect(result).toEqual(expectedRows);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when plantation has no species', async () => {
      mockOrderBy.mockResolvedValue([]);

      const result = await getSpeciesForPlantation('plant-no-species');

      expect(result).toEqual([]);
    });

    it('calls innerJoin with species table (verifies join is used)', async () => {
      mockOrderBy.mockResolvedValue([]);
      const mockInnerJoin = jest.fn(() => ({
        where: jest.fn(() => ({ orderBy: mockOrderBy })),
      }));
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({ innerJoin: mockInnerJoin })),
      }));

      await getSpeciesForPlantation('plant-1');

      expect(mockInnerJoin).toHaveBeenCalledTimes(1);
    });

    it('returns all fields including codigo and nombre from joined species table', async () => {
      const row = {
        id: 'ps-1',
        plantacionId: 'plant-1',
        especieId: 'esp-1',
        ordenVisual: 1,
        codigo: 'ANC',
        nombre: 'Anchico',
      };
      mockOrderBy.mockResolvedValue([row]);

      const result = await getSpeciesForPlantation('plant-1');

      expect(result[0]).toHaveProperty('codigo', 'ANC');
      expect(result[0]).toHaveProperty('nombre', 'Anchico');
      expect(result[0]).toHaveProperty('ordenVisual', 1);
    });
  });
});
