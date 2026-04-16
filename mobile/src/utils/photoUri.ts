import { sql, SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

const LOCAL_URI_SCHEMES = ['file://', 'content://'];

/** Returns true if the URI points to a local file (file://, content://, etc). */
export function isLocalUri(uri: string | null | undefined): uri is string {
  if (!uri) return false;
  return LOCAL_URI_SCHEMES.some(scheme => uri.startsWith(scheme));
}

/** Returns true if the URI is a remote storage path (not local). */
export function isRemoteUri(uri: string | null | undefined): uri is string {
  if (!uri) return false;
  return !isLocalUri(uri);
}

/** Ensures a URI has the file:// scheme (some Android devices return bare paths). */
export function ensureFileUri(uri: string): string {
  return isLocalUri(uri) ? uri : `file://${uri}`;
}

/**
 * SQL fragment: evaluates to true when the column holds a local URI.
 * Use in Drizzle .where() or CASE WHEN expressions.
 */
export function sqlIsLocalUri(column: SQLiteColumn): SQL {
  return sql`(${column} LIKE 'file://%' OR ${column} LIKE 'content://%')`;
}
