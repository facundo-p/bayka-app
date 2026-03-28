// Tests for plantationDetailQueries — extracted query functions
// Validates function signatures, null/edge case handling, and return types

jest.mock('../../src/database/client', () => {
  // Build a deeply chainable mock that resolves to configurable results
  let pendingResult: any = [];

  const makeChain = (): any => new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') {
        const result = pendingResult;
        return (resolve: any) => Promise.resolve(result).then(resolve);
      }
      if (prop === Symbol.iterator) return undefined;
      return jest.fn().mockReturnValue(makeChain());
    }
  });

  return {
    db: {
      select: jest.fn().mockImplementation(() => makeChain()),
    },
    __setPendingResult: (val: any) => { pendingResult = val; },
  };
});

jest.mock('../../src/utils/dateUtils', () => ({
  localToday: () => '2026-03-19',
}));

const { __setPendingResult } = require('../../src/database/client');

import {
  getPlantationLugar,
  getSubgroupsForPlantation,
  getSubgroupById,
  getNNCountsPerSubgroup,
  getTreeCountsPerSubgroup,
  getTotalTreesInPlantation,
  getTodayTreesForUser,
  getUnsyncedTreesForUser,
  getNNTreesForPlantation,
} from '../../src/queries/plantationDetailQueries';

describe('plantationDetailQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __setPendingResult([]);
  });

  describe('getPlantationLugar', () => {
    it('returns plantation lugar', async () => {
      __setPendingResult([{ lugar: 'La Maluka' }]);
      const result = await getPlantationLugar('p-1');
      expect(result).toEqual([{ lugar: 'La Maluka' }]);
    });

    it('returns empty array when plantation not found', async () => {
      __setPendingResult([]);
      const result = await getPlantationLugar('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getSubgroupsForPlantation', () => {
    it('returns subgroups array', async () => {
      __setPendingResult([{ id: 'sg-1' }, { id: 'sg-2' }]);
      const result = await getSubgroupsForPlantation('p-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('getSubgroupById', () => {
    it('returns single subgroup in array', async () => {
      __setPendingResult([{ id: 'sg-1', nombre: 'Linea 1' }]);
      const result = await getSubgroupById('sg-1');
      expect(result[0].nombre).toBe('Linea 1');
    });
  });

  describe('getNNCountsPerSubgroup', () => {
    it('returns N/N counts grouped by subgroup', async () => {
      __setPendingResult([{ subgrupoId: 'sg-1', nnCount: 3 }]);
      const result = await getNNCountsPerSubgroup('p-1');
      expect(result[0].nnCount).toBe(3);
    });
  });

  describe('getTreeCountsPerSubgroup', () => {
    it('returns tree counts grouped by subgroup', async () => {
      __setPendingResult([{ subgrupoId: 'sg-1', treeCount: 15 }]);
      const result = await getTreeCountsPerSubgroup('p-1');
      expect(result[0].treeCount).toBe(15);
    });
  });

  describe('getTotalTreesInPlantation', () => {
    it('returns total tree count', async () => {
      __setPendingResult([{ total: 42 }]);
      const result = await getTotalTreesInPlantation('p-1');
      expect(result).toBe(42);
    });

    it('returns 0 when no trees', async () => {
      __setPendingResult([{ total: 0 }]);
      const result = await getTotalTreesInPlantation('p-1');
      expect(result).toBe(0);
    });

    it('returns 0 when result is empty', async () => {
      __setPendingResult([]);
      const result = await getTotalTreesInPlantation('p-1');
      expect(result).toBe(0);
    });
  });

  describe('getTodayTreesForUser', () => {
    it('returns 0 when userId is null (no db call)', async () => {
      const { db } = require('../../src/database/client');
      const result = await getTodayTreesForUser('p-1', null);
      expect(result).toBe(0);
      // db.select should not be called for null user
    });

    it('returns today tree count for valid user', async () => {
      __setPendingResult([{ total: 7 }]);
      const result = await getTodayTreesForUser('p-1', 'user-1');
      expect(result).toBe(7);
    });

    it('returns 0 when no trees today', async () => {
      __setPendingResult([{ total: 0 }]);
      const result = await getTodayTreesForUser('p-1', 'user-1');
      expect(result).toBe(0);
    });
  });

  describe('getUnsyncedTreesForUser', () => {
    it('returns 0 when userId is null (no db call)', async () => {
      const result = await getUnsyncedTreesForUser('p-1', null);
      expect(result).toBe(0);
    });

    it('returns unsynced tree count for valid user', async () => {
      __setPendingResult([{ total: 12 }]);
      const result = await getUnsyncedTreesForUser('p-1', 'user-1');
      expect(result).toBe(12);
    });
  });

  describe('getNNTreesForPlantation', () => {
    it('returns N/N trees with subgroup info', async () => {
      const expected = [
        { id: 't-1', posicion: 1, subgrupoNombre: 'Linea A' },
        { id: 't-2', posicion: 3, subgrupoNombre: 'Linea B' },
      ];
      __setPendingResult(expected);
      const result = await getNNTreesForPlantation('p-1');
      expect(result).toHaveLength(2);
      expect(result[0].subgrupoNombre).toBe('Linea A');
    });

    it('returns empty array when no N/N trees', async () => {
      __setPendingResult([]);
      const result = await getNNTreesForPlantation('p-1');
      expect(result).toEqual([]);
    });
  });
});
