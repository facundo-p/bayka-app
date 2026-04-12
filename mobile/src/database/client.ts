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

export const db = drizzle(sqlite, { schema });
