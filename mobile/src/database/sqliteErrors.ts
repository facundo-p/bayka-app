/**
 * SQLite error message substrings the expo-sqlite/drizzle driver raises.
 * Centralized so repositories never compare `e.message` against a raw
 * literal (same rationale as PG_ERROR for Postgres codes — see
 * src/supabase/postgresErrorCodes.ts).
 */

/** SQLite raises this substring when an INSERT/UPDATE violates a UNIQUE index or column constraint. */
const UNIQUE_CONSTRAINT_MESSAGE = 'UNIQUE constraint failed';

/** True when `e` is a SQLite UNIQUE constraint violation. */
export function isUniqueConstraintError(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(UNIQUE_CONSTRAINT_MESSAGE);
}

/**
 * Substring of the `groups_parcela_name_unique` index name (see
 * src/database/schema.ts) that SQLite echoes in the UNIQUE violation
 * message — the only way to tell a nombre clash from a codigo clash
 * without a second query.
 */
const NAME_UNIQUE_INDEX_MARKER = 'name_unique';

/** True when a UNIQUE violation `e` was raised by a `*_name_unique` index. */
export function isNameUniqueConstraintError(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(NAME_UNIQUE_INDEX_MARKER);
}
