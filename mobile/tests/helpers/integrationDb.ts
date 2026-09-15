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

/**
 * Un doble de la conexión de expo-sqlite sobre el better-sqlite3 de los tests, para
 * que `enTransaccion` abra transacciones DE VERDAD acá y los tests de atomicidad
 * prueben el rollback real. Copia la forma de `withTransactionAsync`: el BEGIN va
 * adentro del try, así que un BEGIN anidado dispara el ROLLBACK del catch, igual
 * que en producción.
 */
export function sqliteDeIntegracion(sqlite: InstanceType<typeof Database>) {
  return {
    withTransactionAsync: async (task: () => Promise<void>) => {
      try {
        sqlite.exec('BEGIN');
        await task();
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

export function closeTestDb(sqlite: InstanceType<typeof Database>): void {
  sqlite.close();
}
