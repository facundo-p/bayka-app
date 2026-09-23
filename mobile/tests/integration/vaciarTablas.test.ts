import { is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '../../src/database/schema';
import { TABLAS_HIJAS_PRIMERO } from '../helpers/integrationDb';

// La lista es manual: una tabla nueva que falte deja filas entre tests o, si
// tiene FKs, hace fallar la limpieza de todas las suites con un error opaco.
it('vaciarTablas cubre todas las tablas del schema', () => {
  const delSchema = Object.values(schema).filter((v) => is(v, SQLiteTable));
  expect(new Set(TABLAS_HIJAS_PRIMERO)).toEqual(new Set(delSchema));
});
