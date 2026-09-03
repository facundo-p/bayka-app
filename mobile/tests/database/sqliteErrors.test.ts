import {
  isUniqueConstraintError,
  isNameUniqueConstraintError,
  isDuplicateColumnError,
  isNoSuchTableError,
} from '../../src/database/sqliteErrors';

describe('sqliteErrors', () => {
  describe('isUniqueConstraintError', () => {
    it('true for a UNIQUE constraint message', () => {
      expect(isUniqueConstraintError(new Error('UNIQUE constraint failed: groups.codigo'))).toBe(true);
    });

    it('false for unrelated errors', () => {
      expect(isUniqueConstraintError(new Error('no such table: groups'))).toBe(false);
      expect(isUniqueConstraintError(undefined)).toBe(false);
    });
  });

  describe('isNameUniqueConstraintError', () => {
    it('true only when the UNIQUE index name marker is present', () => {
      expect(isNameUniqueConstraintError(new Error('UNIQUE constraint failed: groups_parcela_name_unique'))).toBe(true);
      expect(isNameUniqueConstraintError(new Error('UNIQUE constraint failed: groups_parcela_code_unique'))).toBe(false);
    });
  });

  describe('isDuplicateColumnError', () => {
    it('true for SQLite duplicate column message', () => {
      expect(isDuplicateColumnError(new Error('duplicate column name: foto_synced'))).toBe(true);
    });

    it('false for other error shapes, including non-Error values', () => {
      expect(isDuplicateColumnError(new Error('no such table: trees'))).toBe(false);
      expect(isDuplicateColumnError('duplicate column name: foto_synced')).toBe(false);
      expect(isDuplicateColumnError(null)).toBe(false);
    });
  });

  describe('isNoSuchTableError', () => {
    it('true for SQLite missing table message', () => {
      expect(isNoSuchTableError(new Error('no such table: groups'))).toBe(true);
    });

    it('false for other error shapes', () => {
      expect(isNoSuchTableError(new Error('duplicate column name: pending_sync'))).toBe(false);
      expect(isNoSuchTableError(undefined)).toBe(false);
    });
  });
});
