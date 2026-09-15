/**
 * La única forma correcta de abrir una transacción en la app (#448).
 *
 * `db.transaction()` de drizzle/expo-sqlite es síncrona: hace COMMIT apenas el
 * callback devuelve la promesa, sin esperarla. Con callbacks async la transacción
 * abre y cierra vacía y las filas se escriben en autocommit, una por una.
 *
 * `withTransactionAsync` de expo-sqlite sí espera y revierte ante un throw async.
 * La transacción es de la **conexión**, no de un handle aparte: por eso el
 * callback recibe `db`, y por eso hay que cuidar la ventana en que está abierta
 * (ver `enTransaccionPorLotes` y la cola de abajo).
 */
import { db, sqlite } from './client';
import { syncLog } from '../utils/syncLogger';

type Db = typeof db;

/**
 * Filas por transacción en las escrituras masivas. Un solo commit para 12.000
 * árboles sería algo más rápido, pero mientras la transacción está abierta todo
 * lo que escriba el resto de la app cae adentro y se pierde si el pull revierte.
 * De a 100 la ventana son milisegundos y ya se ganó lo que había para ganar: el
 * salto grande es dejar de commitear fila por fila.
 */
export const FILAS_POR_TRANSACCION = 100;

/**
 * Dos transacciones solapadas sobre la misma conexión se destruyen: el `BEGIN` de
 * la segunda falla, y el `ROLLBACK` con que el driver responde revierte la de la
 * primera. Pasa de verdad —un pull-to-refresh corriendo mientras el usuario borra
 * una plantación— porque `withTransactionAsync` sí tiene puntos de yield.
 */
let cola: Promise<unknown> = Promise.resolve();
let hayUnaAbierta = false;

async function correr<T>(cb: (tx: Db) => Promise<T>): Promise<T> {
  let resultado!: T;
  hayUnaAbierta = true;
  try {
    await sqlite.withTransactionAsync(async () => {
      resultado = await cb(db);
    });
  } finally {
    hayUnaAbierta = false;
  }
  return resultado;
}

export async function enTransaccion<T>(cb: (tx: Db) => Promise<T>): Promise<T> {
  if (typeof sqlite?.withTransactionAsync !== 'function') {
    // `sqlite` ausente es un mock de jest. Presente pero sin el método significa
    // que el driver cambió y la app está escribiendo sin transacción: se grita.
    if (sqlite) syncLog.error('expo-sqlite sin withTransactionAsync: se escribe SIN transacción');
    return cb(db);
  }

  // Anidada: ya estamos adentro de una transacción de esta misma conexión, así que
  // el callback se suma a ella. Esperar el turno sería un deadlock contra sí misma.
  if (hayUnaAbierta) return cb(db);

  const turno = cola.then(() => correr(cb), () => correr(cb));
  cola = turno.then(
    () => undefined,
    () => undefined,
  );
  return turno;
}

/**
 * Escribe en transacciones de a `FILAS_POR_TRANSACCION`. `onLote` corre entre
 * transacciones, no adentro: emitir progreso dispara un render de React, y un
 * render adentro de la transacción deja que la UI lea filas sin commitear.
 */
export async function enTransaccionPorLotes<T>(
  filas: T[],
  escribir: (tx: Db, fila: T) => Promise<void>,
  onLote?: (escritas: number) => void,
): Promise<void> {
  for (let i = 0; i < filas.length; i += FILAS_POR_TRANSACCION) {
    const lote = filas.slice(i, i + FILAS_POR_TRANSACCION);
    await enTransaccion(async (tx) => {
      for (const fila of lote) await escribir(tx, fila);
    });
    onLote?.(i + lote.length);
  }
}
