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
 * Substring de `groups_parcela_name_unique` (ver schema.ts) que SQLite repite en el
 * mensaje de violación UNIQUE — única forma de distinguir un clash de nombre del de
 * código sin una segunda query.
 */
const NAME_UNIQUE_INDEX_MARKER = 'name_unique';

/** True when a UNIQUE violation `e` was raised by a `*_name_unique` index. */
export function isNameUniqueConstraintError(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(NAME_UNIQUE_INDEX_MARKER);
}

/** SQLite raises this substring when `ALTER TABLE ... ADD COLUMN` targets a column that already exists. */
const DUPLICATE_COLUMN_MESSAGE = 'duplicate column name';

/** True when `e` is a SQLite "duplicate column name" error (ADD COLUMN re-run on an already-migrated table). */
export function isDuplicateColumnError(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(DUPLICATE_COLUMN_MESSAGE);
}

/** SQLite raises this substring when a statement targets a table that doesn't exist yet. */
const NO_SUCH_TABLE_MESSAGE = 'no such table';

/** True when `e` is a SQLite "no such table" error (e.g. a bootstrap patch running before drizzle migrations created it). */
export function isNoSuchTableError(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(NO_SUCH_TABLE_MESSAGE);
}
