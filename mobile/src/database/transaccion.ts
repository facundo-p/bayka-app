/**
 * La única forma correcta de abrir una transacción en la app (#448).
 *
 * `db.transaction()` de drizzle/expo-sqlite NO sirve con callbacks async: es
 * síncrona, hace COMMIT apenas el callback devuelve la promesa y no la espera.
 * Con un callback async la transacción abre y cierra **vacía**, y las filas se
 * escriben después, una por una en autocommit. O sea: sin atomicidad, y con un
 * fsync por fila en vez de uno por lote.
 *
 * `withTransactionAsync` de expo-sqlite sí espera el callback y hace ROLLBACK si
 * tira, incluido un throw asíncrono. La transacción es de la conexión, así que
 * las sentencias van por el mismo `db` de siempre: por eso el callback recibe
 * `db` y no un handle aparte.
 *
 * Sin driver nativo (los mocks de jest, que solo exportan `db`) corre el callback
 * sin transacción, como hacía `runInTransaction`. El test que protege esto está
 * en `tests/database/transaccion.test.ts`, contra un doble fiel de cada driver:
 * con el mock de jest la diferencia no se ve.
 */
import { db, sqlite } from './client';

type Db = typeof db;

export async function enTransaccion<T>(cb: (tx: Db) => Promise<T>): Promise<T> {
  if (typeof sqlite?.withTransactionAsync !== 'function') {
    return cb(db);
  }

  let resultado!: T;
  await sqlite.withTransactionAsync(async () => {
    resultado = await cb(db);
  });
  return resultado;
}
