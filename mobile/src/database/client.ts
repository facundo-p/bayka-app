import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const sqlite = SQLite.openDatabaseSync('bayka.db');
sqlite.execSync('PRAGMA journal_mode=WAL;');

// Safety net: ensure foto_synced column exists even if migration 0008 failed.
// ALTER TABLE ADD COLUMN is a no-op if column already exists (SQLite ignores duplicate).
try {
  sqlite.execSync('ALTER TABLE trees ADD COLUMN foto_synced integer NOT NULL DEFAULT 0;');
} catch (_) {
  // Column already exists — expected after successful migration
}

// Safety net: ensure pending_sync column exists even if migration 0009 failed.
try {
  sqlite.execSync('ALTER TABLE subgroups ADD COLUMN pending_sync integer NOT NULL DEFAULT 0;');
  // Column was just created — mark all finalized subgroups as pending sync.
  // DEFAULT 0 leaves existing finalized subgroups (never synced) unmarked.
  // Re-uploading is idempotent (RPC uses ON CONFLICT DO UPDATE).
  sqlite.execSync("UPDATE subgroups SET pending_sync = 1 WHERE estado = 'finalizada';");
} catch (_) {
  // Column already exists — expected after successful migration
}

// One-time fix (v1): mark finalized subgroups that were never synced as pending.
// Covers the case where pending_sync column existed but DEFAULT 0 left
// finalized subgroups unmarked. Uses user_version pragma to run only once.
try {
  const [{ user_version }] = sqlite.getAllSync<{ user_version: number }>('PRAGMA user_version;');
  if (user_version < 1) {
    sqlite.execSync(
      "UPDATE subgroups SET pending_sync = 1 WHERE estado = 'finalizada' AND pending_sync = 0;"
    );
    sqlite.execSync('PRAGMA user_version = 1;');
  }
} catch (_) {
  // Table may not exist yet on fresh install — migrations will handle it
}

// Safety net: ensure conflict columns exist even if migration 0010 failed.
try {
  sqlite.execSync('ALTER TABLE trees ADD COLUMN conflict_especie_id text;');
} catch (_) {
  // Column already exists — expected after successful migration
}
try {
  sqlite.execSync('ALTER TABLE trees ADD COLUMN conflict_especie_nombre text;');
} catch (_) {
  // Column already exists — expected after successful migration
}

export const db = drizzle(sqlite, { schema });
