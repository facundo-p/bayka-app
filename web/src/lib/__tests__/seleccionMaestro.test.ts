import {
  accionDesdeEstado,
  alternarId,
  aplicarMaestro,
  estadoMaestro,
  marcadasEnOrden,
} from '../seleccionMaestro';

const VISIBLES = ['a', 'b', 'c'];

describe('estadoMaestro', () => {
  test('sin filas visibles → ninguna (maestro deshabilitado)', () => {
    expect(estadoMaestro([], new Set(['a']))).toBe('ninguna');
  });

  test('ninguna visible marcada → ninguna', () => {
    expect(estadoMaestro(VISIBLES, new Set())).toBe('ninguna');
  });

  test('todas las visibles marcadas → todas', () => {
    expect(estadoMaestro(VISIBLES, new Set(VISIBLES))).toBe('todas');
  });

  test('algunas visibles marcadas → parcial', () => {
    expect(estadoMaestro(VISIBLES, new Set(['b']))).toBe('parcial');
  });

  test('solo cuenta las visibles (ignora marcadas fuera de la lista)', () => {
    expect(estadoMaestro(['c'], new Set(['a', 'b']))).toBe('ninguna');
  });
});

describe('accionDesdeEstado', () => {
  test('todas desmarca; ninguna/parcial marca', () => {
    expect(accionDesdeEstado('todas')).toBe('desmarcar');
    expect(accionDesdeEstado('ninguna')).toBe('marcar');
    expect(accionDesdeEstado('parcial')).toBe('marcar');
  });
});

describe('alternarId', () => {
  test('marca una fila sin marcar y desmarca una marcada', () => {
    const marcada = alternarId(new Set(), 'a');
    expect([...marcada]).toEqual(['a']);
    expect([...alternarId(marcada, 'a')]).toEqual([]);
  });

  test('no muta la selección de entrada', () => {
    const original = new Set(['a']);
    alternarId(original, 'b');
    expect([...original]).toEqual(['a']);
  });
});

describe('aplicarMaestro', () => {
  test('con ninguna marcada, marca todas las visibles', () => {
    expect([...aplicarMaestro(VISIBLES, new Set())]).toEqual(VISIBLES);
  });

  test('con algunas marcadas, completa todas las visibles', () => {
    expect([...aplicarMaestro(VISIBLES, new Set(['b']))]).toEqual(VISIBLES);
  });

  test('con todas marcadas, las desmarca', () => {
    expect(aplicarMaestro(VISIBLES, new Set(VISIBLES)).size).toBe(0);
  });
});

describe('marcadasEnOrden', () => {
  test('respeta el orden de la lista, no el de marcado', () => {
    expect(marcadasEnOrden(VISIBLES, new Set(['c', 'a']))).toEqual(['a', 'c']);
  });

  test('descarta marcadas que ya no están visibles', () => {
    expect(marcadasEnOrden(['b'], new Set(['a', 'b']))).toEqual(['b']);
  });
});
