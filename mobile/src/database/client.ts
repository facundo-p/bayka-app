import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

/** El handle nativo. Lo usa `enTransaccion`: drizzle no expone transacciones async. */
export const sqlite = SQLite.openDatabaseSync('bayka.db');
sqlite.execSync('PRAGMA journal_mode=WAL;');
// Las migraciones que reconstruyen tablas necesitan las FKs apagadas; se activan después (#616).
sqlite.execSync('PRAGMA foreign_keys = OFF;');

export const db = drizzle(sqlite, { schema });
