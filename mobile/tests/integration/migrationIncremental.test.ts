/**
 * Regresión del bug de timestamps invertidos (#312): drizzle-orm/sqlite-core/dialect.js,
 * SQLiteSyncDialect.migrate (usada por expo-sqlite) lee el `created_at` MAX ya registrado
 * en __drizzle_migrations con un solo `SELECT ... ORDER BY created_at DESC LIMIT 1` (línea 654)
 * y solo aplica una migración si su `when` es estrictamente mayor a ese máximo (línea 660) — no
 * camina el journal en orden ni vuelve a consultar el máximo dentro del loop.
 *
 * Contrato asumido (issue #312, aprobado): ningún device operativo quedó en un estado anterior a
 * este fix — todos ya están en idx >= 15 (max created_at >= 1774300000000, el `when` de la 0015).
 * Este test simula exactamente ese piso: un device que ya migró 0000-0015 y luego recibe una
 * actualización con el journal completo (hasta 0018). Verifica que 0008-0014 (renumeradas a
 * `when` entre las de 0007 y 0015, ver drizzle/meta/_journal.json) NO se reaplican — evitando los
 * "duplicate column"/"table already exists" que dispararían si drizzle intentara correrlas de
 * nuevo — y que 0016-0018 sí se aplican.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DRIZZLE_DIR = path.join(__dirname, '../../drizzle');
const DEVICE_FLOOR_IDX = 15; // Piso asumido: ningún device operativo está por debajo de esto.

type MigrationRow = { hash: string; created_at: number };

function columnNames(sqlite: InstanceType<typeof Database>, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
    .map((row) => row.name);
}

function appliedMigrations(sqlite: InstanceType<typeof Database>): MigrationRow[] {
  return sqlite.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY id').all() as MigrationRow[];
}

/** Carpeta de migraciones truncada a idx <= upToIdx, con copias de los .sql reales — simula el journal que un device vio en su primer install. */
function buildTruncatedMigrationsFolder(upToIdx: number): string {
  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8'));
  const entries = journal.entries.filter((e: { idx: number }) => e.idx <= upToIdx);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bayka-migrations-'));
  fs.mkdirSync(path.join(dir, 'meta'));
  fs.writeFileSync(path.join(dir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }));
  for (const entry of entries as Array<{ tag: string }>) {
    fs.copyFileSync(path.join(DRIZZLE_DIR, `${entry.tag}.sql`), path.join(dir, `${entry.tag}.sql`));
  }
  return dir;
}

test('device en idx 15 no reaplica 0008-0014 y sí aplica 0016-0018 al actualizar', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);

  // Fase 1: fresh install que llega hasta 0015 (piso asumido de todo device operativo).
  const partialDir = buildTruncatedMigrationsFolder(DEVICE_FLOOR_IDX);
  migrate(db, { migrationsFolder: partialDir });
  fs.rmSync(partialDir, { recursive: true, force: true });

  const afterPhase1 = appliedMigrations(sqlite);
  expect(afterPhase1).toHaveLength(DEVICE_FLOOR_IDX + 1);
  expect(Math.max(...afterPhase1.map((r) => Number(r.created_at)))).toBe(1774300000000);

  // Fase 2: la app se actualiza y trae el journal completo (hasta 0018).
  expect(() => migrate(db, { migrationsFolder: DRIZZLE_DIR })).not.toThrow();

  const afterPhase2 = appliedMigrations(sqlite);
  const fullJournal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, 'meta/_journal.json'), 'utf8'));
  expect(afterPhase2).toHaveLength(fullJournal.entries.length); // nada se reaplicó dos veces

  expect(columnNames(sqlite, 'plantations')).toEqual(
    expect.arrayContaining([
      'gps_capture_frequency_server',
      'gps_capture_required_server',
      'visible_in_app',
    ]),
  );

  sqlite.close();
});
