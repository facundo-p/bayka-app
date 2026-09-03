// Unit tests for TreeRepository (mock-based)

// --- DB mock infrastructure ---

let mockInsertValues: jest.Mock;
let mockDeleteWhere: jest.Mock;
let mockUpdateWhere: jest.Mock;

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

let mockDb: any;

beforeAll(() => {
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockUpdateWhere = jest.fn().mockResolvedValue(undefined);

  mockDb = buildMockDb([]);
});

function buildMockDb(selectResults: any[]) {
  return {
    insert: jest.fn(() => ({ values: mockInsertValues })),
    delete: jest.fn(() => ({ where: mockDeleteWhere })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: mockUpdateWhere })),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve(selectResults)),
        orderBy: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve(selectResults)),
        })),
      })),
    })),
    transaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve(selectResults)),
          })),
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({ where: mockUpdateWhere })),
        })),
      };
      await fn(tx);
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
});

import {
  insertTree,
  deleteLastTree,
  reverseTreeOrder,
  resolveNNTree,
  updateTreePhoto,
  deleteTreeAndRecalculate,
} from '../../src/repositories/TreeRepository';

describe('TreeRepository', () => {
  describe('insertTree', () => {
    it('first tree in subgroup gets posicion=1 when MAX returns null', async () => {
      // La fila del mock también sirve al lookup de parcela (parcelaId + codigo 'PC').
      mockDb = buildMockDb([{ maxPos: null, parcelaId: 'p1', codigo: 'PC' }]);

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(result.posicion).toBe(1);
      expect(result.subId).toBe('PCL1ANC1');
      expect(mockInsertValues).toHaveBeenCalledTimes(1);
      const row = mockInsertValues.mock.calls[0][0];
      expect(row.posicion).toBe(1);
      expect(row.especieId).toBe('esp-1');
      expect(row.groupId).toBe('sg-1');
    });

    it('inserts tree with auto-incremented position based on MAX(posicion)', async () => {
      mockDb = buildMockDb([{ maxPos: 3, parcelaId: 'p1', codigo: 'PC' }]);

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(result.posicion).toBe(4);
      expect(result.subId).toBe('PCL1ANC4');
    });

    it('generates correct subId as concatenation parcelaCodigo+grupoCodigo+especieCodigo+posicion', async () => {
      mockDb = buildMockDb([{ maxPos: 12, parcelaId: 'p1', codigo: 'PC' }]);

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L23B',
        especieId: 'esp-2',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(result.subId).toBe('PCL23BANC13');
    });

    it('stores null especieId for N/N trees', async () => {
      mockDb = buildMockDb([{ maxPos: 0, parcelaId: 'p1', codigo: 'PC' }]);

      await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: null,
        especieCodigo: 'NN',
        userId: 'user-1',
      });

      const row = mockInsertValues.mock.calls[0][0];
      expect(row.especieId).toBeNull();
    });

    it('calls notifyDataChanged after insert', async () => {
      mockDb = buildMockDb([{ maxPos: null, parcelaId: 'p1', codigo: 'PC' }]);
      const { notifyDataChanged } = require('../../src/database/liveQuery');

      await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteLastTree', () => {
    it('deletes the tree with the highest posicion', async () => {
      mockDb = buildMockDb([{ maxPos: 5, id: 'tree-5' }]);

      const result = await deleteLastTree('sg-1');

      expect(result.deleted).toBe(true);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    });

    it('returns deleted=false and does not call delete when subgroup has no trees', async () => {
      mockDb = buildMockDb([{ maxPos: null, id: null }]);

      const result = await deleteLastTree('sg-1');

      expect(result.deleted).toBe(false);
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });

    it('calls notifyDataChanged only when a tree is deleted', async () => {
      mockDb = buildMockDb([{ maxPos: 2, id: 'tree-2' }]);
      const { notifyDataChanged } = require('../../src/database/liveQuery');

      await deleteLastTree('sg-1');

      expect(notifyDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('reverseTreeOrder', () => {
    it('runs in a transaction', async () => {
      // [0] lleva parcelaId + codigo para el lookup de getGroupParcelaCodigo.
      const trees = [
        { id: 'tree-1', grupoId: 'sg-1', posicion: 1, especieId: null, subId: 'L1NN1', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];
      mockDb = buildMockDb(trees);

      await reverseTreeOrder('sg-1', 'L1');

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('updates all trees when reversing order', async () => {
      const trees = [
        { id: 'tree-1', grupoId: 'sg-1', posicion: 1, especieId: null, subId: 'L1NN1', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
        { id: 'tree-3', grupoId: 'sg-1', posicion: 3, especieId: null, subId: 'L1NN3', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];
      mockDb = buildMockDb(trees);

      await reverseTreeOrder('sg-1', 'L1');

      // 3 updates inside transaction (one per tree) + 1 for markGroupPendingSync
      expect(mockUpdateWhere).toHaveBeenCalledTimes(4);
    });

    it('does nothing when subgroup is empty', async () => {
      mockDb = buildMockDb([]);

      await reverseTreeOrder('sg-1', 'L1');

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockUpdateWhere).not.toHaveBeenCalled();
    });
  });

  describe('resolveNNTree', () => {
    it('sets especieId and recalculates subId', async () => {
      let callCount = 0;
      mockDb = {
        ...buildMockDb([]),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve([{ codigo: 'ANC' }]); // especie
              if (callCount === 2) return Promise.resolve([{ posicion: 3, grupoId: 'sg-1' }]); // árbol
              if (callCount === 3) return Promise.resolve([{ parcelaId: 'p1' }]); // grupo (getGroupParcelaCodigo)
              return Promise.resolve([{ codigo: 'PC' }]); // parcela
            }),
          })),
        })),
      };

      await resolveNNTree('tree-1', 'esp-1', 'L1');

      // Called twice: once for tree update, once for markGroupPendingSync
      expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    });

    it('does nothing if species or tree not found', async () => {
      mockDb = buildMockDb([]);

      await resolveNNTree('tree-nonexistent', 'esp-nonexistent', 'L1');

      expect(mockUpdateWhere).not.toHaveBeenCalled();
    });
  });

  describe('updateTreePhoto', () => {
    it('calls db update with provided fotoUrl', async () => {
      mockDb = buildMockDb([]);

      await updateTreePhoto('tree-1', 'file://document/photos/photo_123.jpg');

      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    });

    it('sets fotoUrl to empty string when empty string passed', async () => {
      mockDb = buildMockDb([]);

      await updateTreePhoto('tree-1', '');

      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    });

    it('resets fotoSynced to false when updating photo', async () => {
      let capturedSet: any = null;
      mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
      mockDb = {
        ...buildMockDb([]),
        update: jest.fn(() => ({
          set: jest.fn((values: any) => {
            capturedSet = values;
            return { where: mockUpdateWhere };
          }),
        })),
      };

      await updateTreePhoto('tree-1', 'file://document/photos/photo_new.jpg');

      expect(capturedSet).not.toBeNull();
      expect(capturedSet.fotoSynced).toBe(false);
    });
  });

  describe('deleteTreeAndRecalculate', () => {
    it('deletes tree and runs transaction to recalculate positions', async () => {
      const remainingTrees = [
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-3', grupoId: 'sg-1', posicion: 3, especieId: null, subId: 'L1NN3', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];

      // Mock: delete then select remaining then transaction
      let selectCallCount = 0;
      mockDb = {
        delete: jest.fn(() => ({ where: mockDeleteWhere })),
        insert: jest.fn(() => ({ values: mockInsertValues })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({ where: mockUpdateWhere })),
        })),
        // `where()` is both awaitable (array — used by getGroupParcelaCodigo's
        // group/parcela lookup) and chainable via `.orderBy()` (remaining trees).
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => {
              const result: any = Promise.resolve(remainingTrees);
              result.orderBy = jest.fn(() => Promise.resolve(remainingTrees));
              return result;
            }),
          })),
        })),
        transaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
          const tx = {
            select: jest.fn(() => ({
              from: jest.fn(() => ({
                where: jest.fn(() => Promise.resolve([])),
              })),
            })),
            update: jest.fn(() => ({
              set: jest.fn(() => ({ where: mockUpdateWhere })),
            })),
          };
          await fn(tx);
        }),
      };

      await deleteTreeAndRecalculate('tree-1', 'sg-1', 'L1');

      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });
});
