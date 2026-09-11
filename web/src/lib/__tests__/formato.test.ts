import {
  acotarPorcentaje,
  concordar,
  etiquetaCodigoNombre,
  formatearEntero,
  pluralizar,
  porcentaje,
  porcentajeDeObjetivo,
} from '../formato';

test('concordar: singular solo con uno, plural con cero y con más', () => {
  expect(concordar(1, 'árbol', 'árboles')).toBe('árbol');
  expect(concordar(0, 'árbol', 'árboles')).toBe('árboles');
  expect(concordar(2, 'árbol', 'árboles')).toBe('árboles');
});

test('pluralizar: cantidad formateada más el sustantivo concordado', () => {
  expect(pluralizar(1, 'plantación', 'plantaciones')).toBe('1 plantación');
  expect(pluralizar(1260, 'árbol', 'árboles')).toBe('1.260 árboles');
});

test('etiquetaCodigoNombre separa código y nombre con raya', () => {
  expect(etiquetaCodigoNombre({ codigo: 'P1', nombre: 'Norte' })).toBe('P1 — Norte');
});

test('agrega separador de miles es-AR (punto)', () => {
  expect(formatearEntero(12345)).toBe('12.345');
});

test('no toca números de menos de mil', () => {
  expect(formatearEntero(87)).toBe('87');
});

test('formatea cero', () => {
  expect(formatearEntero(0)).toBe('0');
});

test('formatea millones', () => {
  expect(formatearEntero(1240000)).toBe('1.240.000');
});

describe('porcentaje', () => {
  test('redondea al entero más cercano', () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(2, 3)).toBe(67);
  });

  test('total 0 devuelve 0 (nunca NaN)', () => {
    expect(porcentaje(0, 0)).toBe(0);
  });
});

test('acotarPorcentaje lleva el valor al rango de 0 a 100', () => {
  expect(acotarPorcentaje(-5)).toBe(0);
  expect(acotarPorcentaje(42.5)).toBe(42.5);
  expect(acotarPorcentaje(130)).toBe(100);
});

describe('porcentajeDeObjetivo', () => {
  test('avance redondeado hacia la meta', () => {
    expect(porcentajeDeObjetivo(12480, 20000)).toBe(62);
  });

  test('sin objetivo no hay avance: null', () => {
    expect(porcentajeDeObjetivo(500, null)).toBeNull();
  });

  test('objetivo 0 o negativo cuenta como sin objetivo', () => {
    expect(porcentajeDeObjetivo(500, 0)).toBeNull();
    expect(porcentajeDeObjetivo(500, -10)).toBeNull();
  });

  test('superar el objetivo cuenta como cumplido: 100', () => {
    expect(porcentajeDeObjetivo(15000, 10000)).toBe(100);
  });

  test('sin árboles con objetivo definido es 0, no null', () => {
    expect(porcentajeDeObjetivo(0, 10000)).toBe(0);
  });
});
