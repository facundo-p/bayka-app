import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { applyLegacySqlitePatches } from './legacyPatches';

const sqlite = SQLite.openDatabaseSync('bayka.db');
sqlite.execSync('PRAGMA journal_mode=WAL;');

// See legacyPatches.ts for why these are still needed and what they tolerate.
applyLegacySqlitePatches(sqlite);

export const db = drizzle(sqlite, { schema });
