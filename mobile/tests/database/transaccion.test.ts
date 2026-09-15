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

/**
 * `withTransactionAsync` de expo-sqlite, copiado de SQLiteDatabase.js: el BEGIN va
 * ADENTRO del try, así que un BEGIN anidado —que SQLite rechaza— dispara el
 * ROLLBACK del catch, y ese rollback revierte la transacción que ya estaba abierta.
 */
let mockAbierta = false;
const mockSqliteFalso = {
  withTransactionAsync: async (task: () => Promise<void>) => {
    try {
      if (mockAbierta) throw new Error('cannot start a transaction within a transaction');
      mockAbierta = true;
      mockRegistro.push('BEGIN');
      await task();
      mockRegistro.push('COMMIT');
      mockAbierta = false;
    } catch (e) {
      mockRegistro.push('ROLLBACK');
      mockAbierta = false;
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

import { enTransaccion, enTransaccionPorLotes, FILAS_POR_TRANSACCION } from '../../src/database/transaccion';
import { db } from '../../src/database/client';

async function escribirDosFilas(tx: typeof mockDbFalso) {
  await tx.escribir('1');
  await tx.escribir('2');
}

describe('enTransaccion', () => {
  beforeEach(() => {
    mockRegistro.length = 0;
    mockAbierta = false;
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

  // Dos corridas solapadas sobre la misma conexión se destruyen: el BEGIN de la
  // segunda falla y su ROLLBACK revierte la de la primera. Pasa de verdad — un
  // pull-to-refresh mientras el usuario borra una plantación (#448).
  it('serializa dos transacciones solapadas en vez de anidarlas', async () => {
    const lenta = enTransaccion(async (tx) => {
      await (tx as unknown as typeof mockDbFalso).escribir('lenta');
    });
    const rapida = enTransaccion(async (tx) => {
      await (tx as unknown as typeof mockDbFalso).escribir('rapida');
    });

    await Promise.all([lenta, rapida]);

    expect(mockRegistro).toEqual([
      'BEGIN', 'INSERT lenta', 'COMMIT',
      'BEGIN', 'INSERT rapida', 'COMMIT',
    ]);
  });

  // Una corrida que falla no puede dejar la cola trabada para las que siguen.
  it('la cola sigue andando después de una transacción que falla', async () => {
    await expect(enTransaccion(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    await enTransaccion(async (tx) => {
      await (tx as unknown as typeof mockDbFalso).escribir('siguiente');
    });

    expect(mockRegistro).toEqual(['BEGIN', 'ROLLBACK', 'BEGIN', 'INSERT siguiente', 'COMMIT']);
  });

  // Anidada de verdad: esperar el turno sería un deadlock contra sí misma.
  it('una transacción anidada se suma a la abierta, no abre otra', async () => {
    await enTransaccion(async (tx) => {
      await (tx as unknown as typeof mockDbFalso).escribir('externa');
      await enTransaccion(async (interna) => {
        await (interna as unknown as typeof mockDbFalso).escribir('interna');
      });
    });

    expect(mockRegistro).toEqual(['BEGIN', 'INSERT externa', 'INSERT interna', 'COMMIT']);
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

describe('enTransaccionPorLotes', () => {
  beforeEach(() => {
    mockRegistro.length = 0;
    mockAbierta = false;
  });

  /** Un statement por lote, como los upserts multi-fila del pull (#449). */
  const escribirLote = async (tx: unknown, lote: string[]) =>
    (tx as typeof mockDbFalso).escribir(lote.join(','));

  it('escribe adentro de la transacción, no después del commit', async () => {
    await enTransaccionPorLotes(['a', 'b'], escribirLote);

    expect(mockRegistro).toEqual(['BEGIN', 'INSERT a,b', 'COMMIT']);
  });

  // Todo el lote en un statement: el callback lo recibe entero, no fila por fila.
  it('le pasa el lote completo al callback, no una fila por vez', async () => {
    const filas = Array.from({ length: FILAS_POR_TRANSACCION }, (_, i) => `f${i}`);
    const lotes: string[][] = [];

    await enTransaccionPorLotes(filas, async (_tx, lote) => {
      lotes.push(lote);
    });

    expect(lotes).toEqual([filas]);
  });

  // Un solo commit para 12.000 filas sería algo más rápido, pero deja la ventana
  // abierta minutos: lo que escriba el resto de la app cae adentro y se pierde si
  // la transacción revierte.
  it('parte en lotes en vez de una transacción gigante', async () => {
    const filas = Array.from({ length: FILAS_POR_TRANSACCION + 1 }, (_, i) => `f${i}`);

    await enTransaccionPorLotes(filas, escribirLote);

    expect(mockRegistro.filter((e) => e === 'BEGIN')).toHaveLength(2);
    expect(mockRegistro.filter((e) => e.startsWith('INSERT'))).toHaveLength(2);
  });

  // El progreso dispara un render de React: adentro de la transacción, la UI podría
  // leer filas sin commitear que después desaparecen.
  it('emite progreso entre transacciones, nunca adentro', async () => {
    const filas = Array.from({ length: FILAS_POR_TRANSACCION + 1 }, (_, i) => `f${i}`);

    await enTransaccionPorLotes(filas, escribirLote, (escritas) =>
      mockRegistro.push(`PROGRESO ${escritas}`),
    );

    const progresos = mockRegistro
      .map((entrada, i) => ({ entrada, i }))
      .filter(({ entrada }) => entrada.startsWith('PROGRESO'));
    for (const { entrada, i } of progresos) {
      expect(mockRegistro[i - 1]).toBe('COMMIT');
      expect(entrada).toBe(`PROGRESO ${i === progresos[0].i ? FILAS_POR_TRANSACCION : filas.length}`);
    }
    expect(progresos).toHaveLength(2);
  });

  it('sin filas no abre ninguna transacción', async () => {
    await enTransaccionPorLotes([], escribirLote);

    expect(mockRegistro).toEqual([]);
  });
});
