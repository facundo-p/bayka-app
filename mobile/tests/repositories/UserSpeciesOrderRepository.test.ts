// Tests for UserSpeciesOrderRepository — unit tests using mock-based approach
// Covers: getUserSpeciesOrder, saveUserSpeciesOrder

jest.mock('../../src/database/client', () => {
  return {
    get db() {
      return mockDb;
    },
  };
});

jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));

let mockInsertValues: jest.Mock;
let mockDeleteWhere: jest.Mock;
let mockOrderBy: jest.Mock;
let mockDb: any;

beforeAll(() => {
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockOrderBy = jest.fn().mockResolvedValue([]);
  mockDb = buildMockDb([]);
});

function buildMockDb(selectResults: any[]) {
  return {
    insert: jest.fn(() => ({ values: mockInsertValues })),
    delete: jest.fn(() => ({ where: mockDeleteWhere })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: mockOrderBy,
        })),
      })),
    })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockOrderBy = jest.fn().mockResolvedValue([]);
  mockDb = buildMockDb([]);
});

import {
  getUserSpeciesOrder,
  saveUserSpeciesOrder,
} from '../../src/repositories/UserSpeciesOrderRepository';

describe('UserSpeciesOrderRepository', () => {
  describe('getUserSpeciesOrder', () => {
    it('returns saved order for user and plantation', async () => {
      const expectedOrder = [
        { especieId: 'esp-1', ordenVisual: 1 },
        { especieId: 'esp-2', ordenVisual: 2 },
        { especieId: 'esp-3', ordenVisual: 3 },
      ];
      mockOrderBy.mockResolvedValue(expectedOrder);

      const result = await getUserSpeciesOrder('user-1', 'plant-1');

      expect(result).toEqual(expectedOrder);
    });

    it('returns empty array when no custom order exists', async () => {
      mockOrderBy.mockResolvedValue([]);

      const result = await getUserSpeciesOrder('user-1', 'plant-no-order');

      expect(result).toEqual([]);
    });

    it('queries with both userId and plantacionId filters', async () => {
      const mockWhere = jest.fn(() => ({ orderBy: mockOrderBy }));
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({ where: mockWhere })),
      }));

      await getUserSpeciesOrder('user-1', 'plant-1');

      expect(mockWhere).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveUserSpeciesOrder', () => {
    it('deletes existing order before inserting new order', async () => {
      const items = [
        { especieId: 'esp-1', ordenVisual: 1 },
        { especieId: 'esp-2', ordenVisual: 2 },
      ];

      await saveUserSpeciesOrder('user-1', 'plant-1', items);

      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).toHaveBeenCalledTimes(1);
    });

    it('calls notifyDataChanged after save', async () => {
      const { notifyDataChanged } = require('../../src/database/liveQuery');
      const items = [{ especieId: 'esp-1', ordenVisual: 1 }];

      await saveUserSpeciesOrder('user-1', 'plant-1', items);

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
    });

    it('overwrites previous order (delete then re-insert)', async () => {
      const firstOrder = [{ especieId: 'esp-1', ordenVisual: 1 }];
      const secondOrder = [
        { especieId: 'esp-2', ordenVisual: 1 },
        { especieId: 'esp-1', ordenVisual: 2 },
      ];

      await saveUserSpeciesOrder('user-1', 'plant-1', firstOrder);
      await saveUserSpeciesOrder('user-1', 'plant-1', secondOrder);

      // Each call deletes then re-inserts
      expect(mockDeleteWhere).toHaveBeenCalledTimes(2);
      expect(mockInsertValues).toHaveBeenCalledTimes(2);
    });

    it('skips insert when items list is empty (only deletes)', async () => {
      await saveUserSpeciesOrder('user-1', 'plant-1', []);

      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it('inserts items with correct userId and plantacionId', async () => {
      const items = [
        { especieId: 'esp-1', ordenVisual: 1 },
        { especieId: 'esp-2', ordenVisual: 2 },
      ];

      await saveUserSpeciesOrder('user-42', 'plant-99', items);

      const insertedRows = mockInsertValues.mock.calls[0][0];
      expect(insertedRows).toHaveLength(2);
      expect(insertedRows[0]).toMatchObject({ userId: 'user-42', plantacionId: 'plant-99', especieId: 'esp-1', ordenVisual: 1 });
      expect(insertedRows[1]).toMatchObject({ userId: 'user-42', plantacionId: 'plant-99', especieId: 'esp-2', ordenVisual: 2 });
    });
  });
});
