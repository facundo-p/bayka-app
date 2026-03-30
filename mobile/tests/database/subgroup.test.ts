// Tests for SubGroupRepository — implemented in Plan 02-02
// Covers: SUBG-01, SUBG-02, SUBG-03, SUBG-05, SUBG-07

// Mock drizzle-orm/expo-sqlite (used by useSubGroupsForPlantation)
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: jest.fn(),
}));

// Chain mock helpers — created fresh per test via factory
let mockInsertValues: jest.Mock;
let mockUpdateSet: jest.Mock;
let mockUpdateWhere: jest.Mock;
let mockSelectFrom: jest.Mock;
let mockSelectWhere: jest.Mock;
let mockSelectOrderBy: jest.Mock;
let mockSelectLimit: jest.Mock;

jest.mock('../../src/database/client', () => ({
  db: {
    insert: jest.fn(() => ({ values: mockInsertValues })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: mockUpdateWhere,
      })),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: mockSelectLimit,
          orderBy: jest.fn(() => ({
            limit: mockSelectLimit,
          })),
        })),
      })),
    })),
  },
}));

import {
  createSubGroup,
  getLastSubGroupName,
  finalizeSubGroup,
  canEdit,
} from '../../src/repositories/SubGroupRepository';

describe('SubGroupRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockInsertValues = jest.fn().mockResolvedValue(undefined);
    mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
    mockSelectLimit = jest.fn().mockResolvedValue([]);

    // Re-wire the db mock to use the fresh mocks
    const { db } = require('../../src/database/client');
    (db.insert as jest.Mock).mockImplementation(() => ({ values: mockInsertValues }));
    (db.update as jest.Mock).mockImplementation(() => ({
      set: jest.fn(() => ({ where: mockUpdateWhere })),
    }));
    (db.select as jest.Mock).mockImplementation(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: mockSelectLimit,
          orderBy: jest.fn(() => ({
            limit: mockSelectLimit,
          })),
        })),
      })),
    }));
  });

  describe('createSubGroup', () => {
    it('inserts subgroup with correct fields (SUBG-01)', async () => {
      mockInsertValues.mockResolvedValue(undefined);

      const result = await createSubGroup({
        plantacionId: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'la',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.id).toBeTruthy();
      }
      expect(mockInsertValues).toHaveBeenCalledTimes(1);
      const insertedRow = mockInsertValues.mock.calls[0][0];
      expect(insertedRow.codigo).toBe('LA'); // uppercase
      expect(insertedRow.estado).toBe('activa');
      expect(insertedRow.tipo).toBe('linea');
      expect(insertedRow.plantacionId).toBe('plantation-1');
      expect(insertedRow.nombre).toBe('Línea A');
      expect(insertedRow.usuarioCreador).toBe('user-1');
    });

    it('rejects duplicate codigo within same plantation (SUBG-02)', async () => {
      mockInsertValues.mockRejectedValue(
        new Error('UNIQUE constraint failed: subgroups.plantacion_id, subgroups.codigo')
      );

      const result = await createSubGroup({
        plantacionId: 'plantation-1',
        nombre: 'Línea B',
        codigo: 'LA',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('codigo_duplicate');
      }
    });

    it('returns unknown error for non-UNIQUE DB errors', async () => {
      mockInsertValues.mockRejectedValue(new Error('disk I/O error'));

      const result = await createSubGroup({
        plantacionId: 'plantation-1',
        nombre: 'Línea C',
        codigo: 'LC',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('unknown');
      }
    });

    it('allows same codigo in different plantation', async () => {
      mockInsertValues.mockResolvedValue(undefined);

      const result1 = await createSubGroup({
        plantacionId: 'plantation-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });

      const result2 = await createSubGroup({
        plantacionId: 'plantation-2',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('getLastSubGroupName', () => {
    it('returns nombre of most recently created subgroup (SUBG-03)', async () => {
      mockSelectLimit.mockResolvedValue([{ nombre: 'Línea 5' }]);

      const result = await getLastSubGroupName('plantation-1');

      expect(result).toBe('Línea 5');
    });

    it('returns null when no subgroups exist', async () => {
      mockSelectLimit.mockResolvedValue([]);

      const result = await getLastSubGroupName('plantation-1');

      expect(result).toBeNull();
    });
  });

  describe('finalizeSubGroup', () => {
    it('sets estado to finalizada when no N/N trees (SUBG-05)', async () => {
      // Mock db.select for count query (unresolvedNN = 0)
      const { db } = require('../../src/database/client');
      (db.select as jest.Mock).mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          where: jest.fn().mockResolvedValue([{ count: 0 }]),
        })),
      }));

      mockUpdateWhere.mockResolvedValue(undefined);

      const result = await finalizeSubGroup('subgroup-1');

      expect(result.success).toBe(true);
      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
    });

    it('allows finalization even with unresolved N/N trees (SUBG-05)', async () => {
      // Per spec §4.10: N/N blocks sync, not finalization
      const result = await finalizeSubGroup('subgroup-1');

      expect(result.success).toBe(true);
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('ownership', () => {
    it('returns true when creator matches and estado is not sincronizada (SUBG-07)', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1', estado: 'activa' },
        'user-1'
      );
      expect(result).toBe(true);
    });

    it('returns false when estado is sincronizada (immutable)', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1', estado: 'sincronizada' },
        'user-1'
      );
      expect(result).toBe(false);
    });

    it('returns false when userId does not match creator', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1', estado: 'activa' },
        'user-2'
      );
      expect(result).toBe(false);
    });

    it('returns false when finalizada but different user (SUBG-07)', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1', estado: 'finalizada' },
        'user-2'
      );
      expect(result).toBe(false);
    });
  });
});
