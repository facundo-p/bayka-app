import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/database/schema';
import { createTestSpecies, NewSpecies, TEST_SPECIES_ID } from './factories';
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

/** Hijos antes que padres: con las FKs activas, el orden inverso falla. */
const TABLAS_HIJAS_PRIMERO = [
  schema.trees,
  schema.borradosPendientes,
  schema.groups,
  schema.parcelas,
  schema.plantationSpecies,
  schema.userSpeciesOrder,
  schema.plantationUsers,
  schema.plantations,
  schema.species,
] as const;

export async function vaciarTablas(db: IntegrationDb): Promise<void> {
  for (const tabla of TABLAS_HIJAS_PRIMERO) await db.delete(tabla);
}

/**
 * Siembra la especie de `createTestTree`. Opt-in y no en `createTestDb`: hay tests
 * que cuentan filas de `species`.
 */
export async function sembrarEspecieDeTest(
  db: IntegrationDb,
  overrides?: Partial<NewSpecies>,
): Promise<NewSpecies> {
  const especie = createTestSpecies({ id: TEST_SPECIES_ID, ...overrides });
  await db.insert(schema.species).values(especie);
  return especie;
}

export function closeTestDb(sqlite: InstanceType<typeof Database>): void {
  sqlite.close();
}
