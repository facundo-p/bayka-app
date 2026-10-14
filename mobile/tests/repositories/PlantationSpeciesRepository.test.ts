// Unit tests for PlantationSpeciesRepository (mock-based)

jest.mock('../../src/database/client', () => {
  return {
    get db() {
      return mockDb;
    },
  };
});

let mockWhere: jest.Mock;
let mockDb: any;

beforeAll(() => {
  mockWhere = jest.fn().mockResolvedValue([]);
  mockDb = buildMockDb([]);
});

function buildMockDb(selectResults: any[]) {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        innerJoin: jest.fn(() => ({
          where: mockWhere,
        })),
      })),
    })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWhere = jest.fn().mockResolvedValue([]);
  mockDb = buildMockDb([]);
});

import { getSpeciesForPlantation } from '../../src/repositories/PlantationSpeciesRepository';

describe('PlantationSpeciesRepository', () => {
  describe('getSpeciesForPlantation', () => {
    it('ordena por nombre sin distinguir acentos ni mayúsculas (#635)', async () => {
      const fila = (nombre: string) => ({ id: nombre, plantacionId: 'p', especieId: nombre, ordenVisual: 0, codigo: 'X', nombre });
      mockWhere.mockResolvedValue([fila('Zarzamora'), fila('aromo'), fila('Álamo'), fila('Espinillo')]);

      const result = await getSpeciesForPlantation('p');

      expect(result.map((r) => r.nombre)).toEqual(['Álamo', 'aromo', 'Espinillo', 'Zarzamora']);
    });

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
      mockWhere.mockResolvedValue(expectedRows);

      const result = await getSpeciesForPlantation('plant-1');

      expect(result).toEqual(expectedRows);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when plantation has no species', async () => {
      mockWhere.mockResolvedValue([]);

      const result = await getSpeciesForPlantation('plant-no-species');

      expect(result).toEqual([]);
    });

    it('calls innerJoin with species table (verifies join is used)', async () => {
      mockWhere.mockResolvedValue([]);
      const mockInnerJoin = jest.fn(() => ({
        where: mockWhere,
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
      mockWhere.mockResolvedValue([row]);

      const result = await getSpeciesForPlantation('plant-1');

      expect(result[0]).toHaveProperty('codigo', 'ANC');
      expect(result[0]).toHaveProperty('nombre', 'Anchico');
      expect(result[0]).toHaveProperty('ordenVisual', 1);
    });
  });
});
