/**
 * Los upserts del pull mandan `FILAS_POR_TRANSACCION` filas en un solo statement
 * (#449), y cada columna de cada fila es un parámetro. Pasarse de
 * SQLITE_MAX_VARIABLE_NUMBER no rompe en desarrollo ni en los tests chicos: rompe
 * en device, en medio de un pull grande, con "too many SQL variables".
 *
 * Este test es la red de ese cálculo. Si falla porque una tabla creció, la salida
 * es bajar `FILAS_POR_TRANSACCION`, no subir el tope.
 */
jest.mock('../../src/database/client', () => ({ db: {}, sqlite: undefined }));

import { getTableColumns, is, Table } from 'drizzle-orm';
import * as schema from '../../src/database/schema';
import { FILAS_POR_TRANSACCION } from '../../src/database/transaccion';

/** Default de SQLite ≥ 3.32, que es el que bundlea expo-sqlite (3.50). */
const MAX_PARAMETROS = 32766;

const tablas = Object.entries(schema).filter(([, valor]) => is(valor, Table)) as Array<[string, Table]>;

describe('FILAS_POR_TRANSACCION vs SQLITE_MAX_VARIABLE_NUMBER', () => {
  it('encuentra las tablas del schema', () => {
    expect(tablas.length).toBeGreaterThan(5);
  });

  it.each(tablas)('un lote de %s entra en un solo statement', (_nombre, tabla) => {
    const columnas = Object.keys(getTableColumns(tabla)).length;

    expect(FILAS_POR_TRANSACCION * columnas).toBeLessThan(MAX_PARAMETROS);
  });
});
