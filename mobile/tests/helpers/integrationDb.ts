import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/database/schema';
import path from 'path';

export type IntegrationDb = ReturnType<typeof drizzle<typeof schema>>;

export function createTestDb(): { db: IntegrationDb; sqlite: InstanceType<typeof Database> } {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  // Run all migrations from drizzle folder
  const migrationsFolder = path.join(__dirname, '../../drizzle');
  migrate(db, { migrationsFolder });

  return { db, sqlite };
}

export function closeTestDb(sqlite: InstanceType<typeof Database>): void {
  sqlite.close();
}
