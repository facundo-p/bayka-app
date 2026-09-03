/**
 * Real bug (see legacyPatches.ts docstring): drizzle-orm's sqlite migrator only compares each
 * migration's journal `when` against the single highest `created_at` already recorded, not
 * sequential order. Migrations 0008-0010 got a `when` lower than 0007's, so a device that had
 * already applied through 0007 permanently skips them. These tests reproduce that "old device"
 * state with real SQLite (better-sqlite3) and verify applyLegacySqlitePatches compensates,
 * without regressing a genuinely fresh install (zero tables) or an already up-to-date device.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import path from 'path';
import { applyLegacySqlitePatches, SqliteSyncHandle } from '../../src/database/legacyPatches';

const DRIZZLE_DIR = path.resolve(__dirname, '../../drizzle');
const OLD_DEVICE_MIGRATION_TAGS = [
  '0000_peaceful_winter_soldier',
  '0001_noisy_triton',
  '0002_overrated_revanche',
  '0003_closed_zuras',
  '0004_species_uuid_migration',
  '0005_user_species_order',
  '0006_add_pending_sync',
  '0007_add_pending_edit',
];

function makeHandle(sqlite: InstanceType<typeof Database>): SqliteSyncHandle {
  return {
    execSync: (source: string) => {
      sqlite.exec(source);
    },
    getAllSync: <T,>(source: string) => sqlite.prepare(source).all() as T[],
  };
}

/** Applies only migrations 0000-0007 directly (no drizzle journal), simulating a device stuck there. */
function buildOldDeviceDb(): InstanceType<typeof Database> {
  const sqlite = new Database(':memory:');
  for (const tag of OLD_DEVICE_MIGRATION_TAGS) {
    const sql = fs.readFileSync(path.join(DRIZZLE_DIR, `${tag}.sql`), 'utf8');
    sqlite.exec(sql.replace(/--> statement-breakpoint/g, ''));
  }
  return sqlite;
}

function buildFullyMigratedDb(): InstanceType<typeof Database> {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: DRIZZLE_DIR });
  return sqlite;
}

function columnNames(sqlite: InstanceType<typeof Database>, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((r) => r.name);
}

describe('applyLegacySqlitePatches', () => {
  it('is a no-op on a genuinely fresh install (no tables at all)', () => {
    const sqlite = new Database(':memory:');
    expect(() => applyLegacySqlitePatches(makeHandle(sqlite))).not.toThrow();
    sqlite.close();
  });

  it('adds the drizzle 0008/0010 columns to trees on an "old device" stuck at migration 0007', () => {
    const sqlite = buildOldDeviceDb();
    expect(columnNames(sqlite, 'trees')).not.toContain('foto_synced');

    expect(() => applyLegacySqlitePatches(makeHandle(sqlite))).not.toThrow();

    const cols = columnNames(sqlite, 'trees');
    expect(cols).toEqual(
      expect.arrayContaining(['foto_synced', 'conflict_especie_id', 'conflict_especie_nombre'])
    );
    sqlite.close();
  });

  it('does not touch groups.pending_sync on an "old device" where migration 0011 never ran (only `subgroups` exists)', () => {
    // Same scenario as above, one layer deeper: migration 0011 (subgroups -> groups rename) is
    // also skipped by the same drizzle bug, so `groups` doesn't exist yet at this point either.
    const sqlite = buildOldDeviceDb();
    const tables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((r) => r.name);
    expect(tables).toContain('subgroups');
    expect(tables).not.toContain('groups');

    expect(() => applyLegacySqlitePatches(makeHandle(sqlite))).not.toThrow();
    sqlite.close();
  });

  it('is a no-op on an already fully-migrated device (every column already exists)', () => {
    const sqlite = buildFullyMigratedDb();
    const before = columnNames(sqlite, 'trees');

    expect(() => applyLegacySqlitePatches(makeHandle(sqlite))).not.toThrow();

    expect(columnNames(sqlite, 'trees')).toEqual(before);
    sqlite.close();
  });

  it('backfills pending_sync=1 for already-finalized groups the first time the column is created', () => {
    const sqlite = buildOldDeviceDb();
    // Migration 0011 renames subgroups -> groups; build a minimal `groups` table by hand here
    // (without pending_sync) to isolate this patch from the deeper subgroups/groups issue above.
    sqlite.exec(`CREATE TABLE groups (id text PRIMARY KEY, estado text NOT NULL)`);
    sqlite.exec(`INSERT INTO groups (id, estado) VALUES ('g1', 'finalizada'), ('g2', 'activa')`);
    // Device already past the v4 one-time fix (see applyPendingSyncCounterFix) — otherwise that
    // block unconditionally clears pending_sync right after this backfill runs, on purpose
    // (same inherited ordering as the original bootstrap code; not something this refactor changes).
    sqlite.exec('PRAGMA user_version = 4;');

    applyLegacySqlitePatches(makeHandle(sqlite));

    const rows = sqlite.prepare('SELECT id, pending_sync FROM groups ORDER BY id').all();
    expect(rows).toEqual([
      { id: 'g1', pending_sync: 1 },
      { id: 'g2', pending_sync: 0 },
    ]);
    sqlite.close();
  });

  it('a truly fresh install clears pending_sync right after backfilling it (inherited v4 fix ordering)', () => {
    const sqlite = buildOldDeviceDb();
    sqlite.exec(`CREATE TABLE groups (id text PRIMARY KEY, estado text NOT NULL)`);
    sqlite.exec(`INSERT INTO groups (id, estado) VALUES ('g1', 'finalizada')`);
    // user_version defaults to 0 on a fresh db — the v4 fix runs unconditionally after this backfill.

    applyLegacySqlitePatches(makeHandle(sqlite));

    const row = sqlite.prepare('SELECT pending_sync FROM groups WHERE id = ?').get('g1') as { pending_sync: number };
    expect(row.pending_sync).toBe(0);
    sqlite.close();
  });

  it('rethrows an unexpected SQLite error instead of swallowing it', () => {
    const handle: SqliteSyncHandle = {
      execSync: () => {
        throw new Error('database disk image is malformed');
      },
      getAllSync: <T,>() => [] as T[],
    };

    expect(() => applyLegacySqlitePatches(handle)).toThrow('database disk image is malformed');
  });
});
