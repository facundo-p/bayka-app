import {
  isUniqueConstraintError,
  isNameUniqueConstraintError,
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
});
