/**
 * Reproducción del bug real del milestone GPS: en un device que YA registró las
 * migraciones 0000–0007 (timestamps 2026, máx created_at = 1774200000000), las
 * 0015/0016 con `when` menor se salteaban → faltaban las columnas GPS en runtime
 * ("no such column: trees.latitude").
 *
 * Este test simula ese device incremental con SQLite real y verifica que, con el
 * `when` corregido (> máx global del journal), 0015 y 0016 SÍ se aplican.
 * Si alguien vuelve a bajar el `when` de una migración nueva, este test falla.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

// Máximo created_at que un device real registró: el `when` de la 0007 (2026).
const DEVICE_MAX_CREATED_AT = 1774200000000;

function columnNames(sqlite: InstanceType<typeof Database>, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
    .map((row) => row.name);
}

test('0015/0016 se aplican en un device incremental con max created_at = 1774200000000', () => {
  const sqlite = new Database(':memory:');

  // Estado pre-0015 de un device real: trees/plantations existen SIN columnas GPS.
  sqlite.exec('CREATE TABLE trees (id text)');
  sqlite.exec('CREATE TABLE plantations (id text)');

  // __drizzle_migrations con el máx created_at de las 0000–0007 (retimestamped a 2026).
  sqlite.exec(
    'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)',
  );
  sqlite
    .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
    .run('seed-0007', DEVICE_MAX_CREATED_AT);

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });

  expect(columnNames(sqlite, 'trees')).toEqual(
    expect.arrayContaining(['latitude', 'longitude', 'gps_accuracy', 'gps_captured_at']),
  );
  expect(columnNames(sqlite, 'plantations')).toEqual(
    expect.arrayContaining([
      'gps_capture_frequency',
      'gps_capture_required',
      'gps_capture_frequency_server',
      'gps_capture_required_server',
    ]),
  );

  sqlite.close();
});
