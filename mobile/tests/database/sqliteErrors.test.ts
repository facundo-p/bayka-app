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
    // Mensajes reales de SQLite: nombra las columnas del índice, no el índice.
    it('true only when the violated UNIQUE includes the nombre column', () => {
      expect(isNameUniqueConstraintError(new Error('UNIQUE constraint failed: groups.parcela_id, groups.nombre'))).toBe(true);
      expect(isNameUniqueConstraintError(new Error('UNIQUE constraint failed: parcelas.plantacion_id, parcelas.nombre'))).toBe(true);
      expect(isNameUniqueConstraintError(new Error('UNIQUE constraint failed: parcelas.plantacion_id, parcelas.codigo'))).toBe(false);
    });

    it('false for a non-UNIQUE error that mentions the column', () => {
      expect(isNameUniqueConstraintError(new Error('NOT NULL constraint failed: groups.nombre'))).toBe(false);
    });
  });
});
