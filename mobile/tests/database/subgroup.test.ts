// Tests for GroupRepository

// Mock drizzle-orm/expo-sqlite (used by useGroupsForPlantation)
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: jest.fn(),
}));

// Chain mock helpers — created fresh per test via factory
let mockInsertValues: jest.Mock;
let mockUpdateWhere: jest.Mock;
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
  createGroup,
  getLastGroupName,
  finalizeGroup,
  canEdit,
} from '../../src/repositories/GroupRepository';

describe('GroupRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockInsertValues = jest.fn().mockResolvedValue(undefined);
    mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
    mockSelectLimit = jest.fn().mockResolvedValue([]);

    // clearAllMocks resets implementations too, so the db mock needs re-wiring
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

  describe('createGroup', () => {
    it('inserts subgroup with correct fields', async () => {
      mockInsertValues.mockResolvedValue(undefined);

      const result = await createGroup({
        plantacionId: 'plantation-1',
        parcelaId: 'parcela-1',
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

    it('rejects duplicate codigo within same plantation', async () => {
      mockInsertValues.mockRejectedValue(
        new Error('UNIQUE constraint failed: groups.plantacion_id, groups.codigo')
      );

      const result = await createGroup({
        plantacionId: 'plantation-1',
        parcelaId: 'parcela-1',
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

      const result = await createGroup({
        plantacionId: 'plantation-1',
        parcelaId: 'parcela-1',
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

      const result1 = await createGroup({
        plantacionId: 'plantation-1',
        parcelaId: 'parcela-1',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });

      const result2 = await createGroup({
        plantacionId: 'plantation-2',
        parcelaId: 'parcela-2',
        nombre: 'Línea A',
        codigo: 'LA',
        tipo: 'linea',
        usuarioCreador: 'user-1',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('getLastGroupName', () => {
    it('returns nombre of most recently created subgroup', async () => {
      mockSelectLimit.mockResolvedValue([{ nombre: 'Línea 5' }]);

      const result = await getLastGroupName('plantation-1');

      expect(result).toBe('Línea 5');
    });

    it('returns null when no groups exist', async () => {
      mockSelectLimit.mockResolvedValue([]);

      const result = await getLastGroupName('plantation-1');

      expect(result).toBeNull();
    });
  });

  describe('finalizeGroup', () => {
    it('sets estado to finalizada and marks pendingSync', async () => {
      mockUpdateWhere.mockResolvedValue(undefined);

      const result = await finalizeGroup('subgroup-1');

      expect(result.success).toBe(true);
      // Called twice: once for estado update, once for markGroupPendingSync
      expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
    });

    it('allows finalization even with unresolved N/N trees', async () => {
      // N/N sin resolver bloquea el sync, no la finalización.
      const result = await finalizeGroup('subgroup-1');

      expect(result.success).toBe(true);
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('ownership', () => {
    it('returns true when creator matches and plantation is activa', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1' },
        'user-1',
        { estado: 'activa', archivadaEn: null, eliminadaEnServidorEn: null }
      );
      expect(result).toBe(true);
    });

    it('returns false when plantation is finalizada (immutable)', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1' },
        'user-1',
        { estado: 'finalizada', archivadaEn: null, eliminadaEnServidorEn: null }
      );
      expect(result).toBe(false);
    });

    it('returns false when plantation is archivada (#477)', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1' },
        'user-1',
        { estado: 'activa', archivadaEn: '2026-09-17T12:00:00+00:00', eliminadaEnServidorEn: null }
      );
      expect(result).toBe(false);
    });

    it('returns false when userId does not match creator', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1' },
        'user-2',
        { estado: 'activa', archivadaEn: null, eliminadaEnServidorEn: null }
      );
      expect(result).toBe(false);
    });

    it('returns false when finalizada plantation and different user', () => {
      const result = canEdit(
        { usuarioCreador: 'user-1' },
        'user-2',
        { estado: 'finalizada', archivadaEn: null, eliminadaEnServidorEn: null }
      );
      expect(result).toBe(false);
    });
  });
});
