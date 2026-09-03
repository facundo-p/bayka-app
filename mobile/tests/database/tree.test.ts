// Tests for TreeRepository

// --- DB mock infrastructure ---

let mockSelectResults: any[] = [];
let mockInsertValues: jest.Mock;
let mockDeleteWhere: jest.Mock;
let mockUpdateWhere: jest.Mock;
let mockTransactionFn: jest.Mock;

// db.select() chain is flexible: any .where() resolves to mockSelectResults,
// which tests reassign per case.

jest.mock('../../src/database/client', () => {
  return {
    get db() {
      return mockDb;
    },
  };
});

// mockDb defined after jest.mock (hoisted)
let mockDb: any;

beforeAll(() => {
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
  mockTransactionFn = jest.fn();

  mockDb = {
    insert: jest.fn(() => ({ values: mockInsertValues })),
    delete: jest.fn(() => ({ where: mockDeleteWhere })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: mockUpdateWhere })),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() =>
          Promise.resolve(mockSelectResults)
        ),
      })),
    })),
    transaction: jest.fn(async (fn: (tx: any) => Promise<void>) => {
      // Run with a tx that has the same shape as db
      const tx = {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve(mockSelectResults)),
          })),
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({ where: mockUpdateWhere })),
        })),
      };
      await fn(tx);
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectResults = [];
  mockInsertValues = jest.fn().mockResolvedValue(undefined);
  mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
  mockUpdateWhere = jest.fn().mockResolvedValue(undefined);

  mockDb.insert = jest.fn(() => ({ values: mockInsertValues }));
  mockDb.delete = jest.fn(() => ({ where: mockDeleteWhere }));
  mockDb.update = jest.fn(() => ({
    set: jest.fn(() => ({ where: mockUpdateWhere })),
  }));
  mockDb.select = jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve(mockSelectResults)),
    })),
  }));
  mockDb.transaction = jest.fn(async (fn: (tx: any) => Promise<void>) => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve(mockSelectResults)),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({ where: mockUpdateWhere })),
      })),
    };
    await fn(tx);
  });
});

import {
  insertTree,
  deleteLastTree,
  reverseTreeOrder,
  resolveNNTree,
  updateTreePhoto,
} from '../../src/repositories/TreeRepository';

describe('TreeRepository', () => {
  describe('insertTree', () => {
    it('first tree in subgroup gets posicion=1 (TREE-03)', async () => {
      // MAX(posicion) returns null when no trees exist. La fila también sirve para
      // el lookup de parcela (getGroupParcelaCodigo): parcelaId + codigo 'PC'.
      mockSelectResults = [{ maxPos: null, parcelaId: 'p1', codigo: 'PC' }];

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
      expect(row.subId).toBe('PCL1ANC1');
      expect(row.especieId).toBe('esp-1');
      expect(row.groupId).toBe('sg-1');
    });

    it('inserts tree with auto-incremented position (TREE-02, TREE-03)', async () => {
      mockSelectResults = [{ maxPos: 3, parcelaId: 'p1', codigo: 'PC' }];

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

    it('generates correct subId (TREE-04)', async () => {
      mockSelectResults = [{ maxPos: 12, parcelaId: 'p1', codigo: 'PC' }];

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L23B',
        especieId: 'esp-2',
        especieCodigo: 'ANC',
        userId: 'user-1',
      });

      // generateSubId('PC', 'L23B', 'ANC', 13) → 'PCL23BANC13'
      expect(result.subId).toBe('PCL23BANC13');
    });

    it('stores null especieId for N/N trees (NN-01)', async () => {
      mockSelectResults = [{ maxPos: 0, parcelaId: 'p1', codigo: 'PC' }];

      const result = await insertTree({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: null,
        especieCodigo: 'NN',
        userId: 'user-1',
      });

      const row = mockInsertValues.mock.calls[0][0];
      expect(row.especieId).toBeNull();
      expect(result.subId).toBe('PCL1NN1');
    });
  });

  describe('deleteLastTree', () => {
    it('deletes only the last tree by posicion (TREE-07)', async () => {
      mockSelectResults = [{ maxPos: 5, id: 'tree-5' }];

      const result = await deleteLastTree('sg-1');

      expect(result.deleted).toBe(true);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    });

    it('does nothing if subgroup has no trees', async () => {
      mockSelectResults = [{ maxPos: null, id: null }];

      const result = await deleteLastTree('sg-1');

      expect(result.deleted).toBe(false);
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });
  });

  describe('reverseTreeOrder', () => {
    it('runs in a transaction (all updates or none)', async () => {
      // [0] lleva parcelaId + codigo para el lookup de getGroupParcelaCodigo.
      mockSelectResults = [
        { id: 'tree-1', grupoId: 'sg-1', posicion: 1, especieId: 'esp-1', subId: 'L1ANC1', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: 'esp-1', subId: 'L1ANC2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];

      await reverseTreeOrder('sg-1', 'L1');

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('updates all posicion values using formula total-N+1 (REVR-01, REVR-02)', async () => {
      mockSelectResults = [
        { id: 'tree-1', grupoId: 'sg-1', posicion: 1, especieId: null, subId: 'L1NN1', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
        { id: 'tree-3', grupoId: 'sg-1', posicion: 3, especieId: null, subId: 'L1NN3', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];

      await reverseTreeOrder('sg-1', 'L1');

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      // 3 updates (once per tree in tx) + 1 for markGroupPendingSync
      expect(mockUpdateWhere).toHaveBeenCalledTimes(4);
    });

    it('recalculates subId for each tree after reversal (REVR-02)', async () => {
      // 2 N/N trees — species code stays 'NN'
      mockSelectResults = [
        { id: 'tree-1', grupoId: 'sg-1', posicion: 1, especieId: null, subId: 'L1NN1', fotoUrl: null, usuarioRegistro: 'u', createdAt: '', parcelaId: 'p1', codigo: 'PC' },
        { id: 'tree-2', grupoId: 'sg-1', posicion: 2, especieId: null, subId: 'L1NN2', fotoUrl: null, usuarioRegistro: 'u', createdAt: '' },
      ];

      await reverseTreeOrder('sg-1', 'L1');

      // tree-1 (pos=1) → newPosicion = 2-1+1 = 2 → 'L1NN2'
      // tree-2 (pos=2) → newPosicion = 2-2+1 = 1 → 'L1NN1'
      // Plus 1 for markGroupPendingSync
      const allSets = mockUpdateWhere.mock.calls;
      expect(allSets).toHaveLength(3);
    });

    it('does nothing when subgroup is empty', async () => {
      mockSelectResults = [];

      await reverseTreeOrder('sg-1', 'L1');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe('resolveNNTree', () => {
    it('sets especieId and recalculates subId (NN-04)', async () => {
      // First call returns species row, second returns tree row with posicion + grupoId
      let callCount = 0;
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            callCount++;
            if (callCount === 1) return Promise.resolve([{ codigo: 'ANC' }]); // especie
            if (callCount === 2) return Promise.resolve([{ posicion: 3, grupoId: 'sg-1' }]); // árbol
            if (callCount === 3) return Promise.resolve([{ parcelaId: 'p1' }]); // grupo (getGroupParcelaCodigo)
            return Promise.resolve([{ codigo: 'PC' }]); // parcela
          }),
        })),
      }));

      await resolveNNTree('tree-1', 'esp-1', 'L1');

      // Called twice: once for tree update, once for markGroupPendingSync
      expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    });

    it('does nothing if tree or species not found', async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([])),
        })),
      }));

      await resolveNNTree('tree-nonexistent', 'esp-nonexistent', 'L1');

      expect(mockUpdateWhere).not.toHaveBeenCalled();
    });
  });

  describe('updateTreePhoto', () => {
    it('updates fotoUrl for the given tree', async () => {
      await updateTreePhoto('tree-1', 'file://document/photos/photo_123.jpg');

      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    });
  });
});
