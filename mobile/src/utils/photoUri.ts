import { sql, SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

/** Esquemas de una foto que sigue en el dispositivo. Contrato en `contracts/foto-local.json`. */
export const LOCAL_URI_SCHEMES = ['file://', 'content://'] as const;

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

/** Una foto tomada en este teléfono que el servidor todavía no tiene. Sin dato de sync cuenta como subida. */
export function fotoSinSubir(arbol: { fotoUrl: string | null | undefined; fotoSynced?: boolean | null }): boolean {
  return isLocalUri(arbol.fotoUrl) && arbol.fotoSynced === false;
}

/** Ensures a URI has the file:// scheme (some Android devices return bare paths). */
export function ensureFileUri(uri: string): string {
  return isLocalUri(uri) ? uri : `file://${uri}`;
}

/** SQL fragment: true when the column holds a local URI. Use in Drizzle .where() or CASE WHEN expressions. */
export function sqlIsLocalUri(column: SQLiteColumn): SQL {
  // Patrones literales y no parámetros: los esquemas son constantes del código.
  const condiciones = LOCAL_URI_SCHEMES.map(
    (scheme) => sql`${column} LIKE ${sql.raw(`'${scheme}%'`)}`,
  );
  return sql`(${sql.join(condiciones, sql` OR `)})`;
}
