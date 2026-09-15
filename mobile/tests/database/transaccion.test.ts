/**
 * El bug de #448 no lo podía ver ningún test porque el mock de `db.transaction`
 * era *más correcto* que el driver: devolvía la promesa del callback y la
 * esperaba. Estos tests usan dobles fieles a cada driver y afirman el orden real
 * de BEGIN / escrituras / COMMIT.
 */
const mockRegistro: string[] = [];

/**
 * `transaction()` de drizzle-orm/expo-sqlite tal como está implementado: síncrono,
 * llama al callback y hace COMMIT sin esperar la promesa.
 */
function mockTransactionDeDrizzle(fn: (tx: unknown) => unknown): unknown {
  mockRegistro.push('BEGIN');
  try {
    const resultado = fn(mockDbFalso);
    mockRegistro.push('COMMIT');
    return resultado;
  } catch (e) {
    mockRegistro.push('ROLLBACK');
    throw e;
  }
}

const mockDbFalso = {
  transaction: mockTransactionDeDrizzle,
  escribir: async (fila: string) => {
    await Promise.resolve();
    mockRegistro.push(`INSERT ${fila}`);
  },
};

/** `withTransactionAsync` de expo-sqlite, que sí espera y revierte. */
const mockSqliteFalso = {
  withTransactionAsync: async (task: () => Promise<void>) => {
    mockRegistro.push('BEGIN');
    try {
      await task();
      mockRegistro.push('COMMIT');
    } catch (e) {
      mockRegistro.push('ROLLBACK');
      throw e;
    }
  },
};

jest.mock('../../src/database/client', () => ({
  get db() {
    return mockDbFalso;
  },
  get sqlite() {
    return mockSqliteFalso;
  },
}));

import { enTransaccion } from '../../src/database/transaccion';
import { db } from '../../src/database/client';

async function escribirDosFilas(tx: typeof mockDbFalso) {
  await tx.escribir('1');
  await tx.escribir('2');
}

describe('enTransaccion', () => {
  beforeEach(() => {
    mockRegistro.length = 0;
  });

  it('las escrituras caen adentro de la transacción', async () => {
    await enTransaccion((tx) => escribirDosFilas(tx as unknown as typeof mockDbFalso));

    expect(mockRegistro).toEqual(['BEGIN', 'INSERT 1', 'INSERT 2', 'COMMIT']);
  });

  it('devuelve lo que devuelve el callback', async () => {
    const resultado = await enTransaccion(async () => 'listo');

    expect(resultado).toBe('listo');
  });

  it('un throw asíncrono revierte, no queda la transacción abierta', async () => {
    const falla = enTransaccion(async (tx) => {
      await (tx as unknown as typeof mockDbFalso).escribir('1');
      throw new Error('se cortó la red');
    });

    await expect(falla).rejects.toThrow('se cortó la red');
    expect(mockRegistro).toEqual(['BEGIN', 'INSERT 1', 'ROLLBACK']);
  });

  // Este es el que justifica que exista `enTransaccion`: si alguien "simplifica"
  // volviendo a `db.transaction`, el orden de arriba se rompe así.
  it('db.transaction de drizzle commitea antes de escribir una sola fila', async () => {
    await (db as unknown as typeof mockDbFalso).transaction((tx) =>
      escribirDosFilas(tx as typeof mockDbFalso),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(mockRegistro).toEqual(['BEGIN', 'COMMIT', 'INSERT 1', 'INSERT 2']);
  });

  // El rollback del driver síncrono tampoco alcanza: solo ve throws síncronos.
  it('db.transaction de drizzle no revierte un throw asíncrono', async () => {
    const falla = (db as unknown as typeof mockDbFalso).transaction(async (tx) => {
      await (tx as typeof mockDbFalso).escribir('1');
      throw new Error('se cortó la red');
    }) as Promise<void>;

    await expect(falla).rejects.toThrow('se cortó la red');
    expect(mockRegistro).toEqual(['BEGIN', 'COMMIT', 'INSERT 1']);
  });
});
