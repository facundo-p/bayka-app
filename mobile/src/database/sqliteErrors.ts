/**
 * SQLite error message substrings que expone el driver expo-sqlite/drizzle.
 * Centralizado para que los repositories no comparen `e.message` contra un
 * literal suelto (mismo criterio que PG_ERROR en postgresErrorCodes.ts).
 */

/** SQLite raises this substring when an INSERT/UPDATE violates a UNIQUE index or column constraint. */
const UNIQUE_CONSTRAINT_MESSAGE = 'UNIQUE constraint failed';

/** True when `e` is a SQLite UNIQUE constraint violation. */
export function isUniqueConstraintError(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(UNIQUE_CONSTRAINT_MESSAGE);
}

/**
 * SQLite nombra las columnas del índice, no el índice: `UNIQUE constraint failed:
 * parcelas.plantacion_id, parcelas.nombre`. La columna `nombre` distingue el clash de
 * nombre del de código sin una segunda query, en `groups` y en `parcelas`.
 */
const NAME_UNIQUE_COLUMN_MARKER = '.nombre';

/** True when a UNIQUE violation `e` involves a `nombre` column. */
export function isNameUniqueConstraintError(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return isUniqueConstraintError(e) && typeof message === 'string' && message.includes(NAME_UNIQUE_COLUMN_MARKER);
}

/** Un UNIQUE que la validación previa no vio (carrera con otra escritura), en el vocabulario de los repositorios. */
export function errorDeDuplicado(e: unknown): 'nombre_duplicate' | 'codigo_duplicate' | 'unknown' {
  if (!isUniqueConstraintError(e)) return 'unknown';
  return isNameUniqueConstraintError(e) ? 'nombre_duplicate' : 'codigo_duplicate';
}
