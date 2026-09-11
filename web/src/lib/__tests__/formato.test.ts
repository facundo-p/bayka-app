import { concordar, etiquetaCodigoNombre, formatearEntero, pluralizar } from '../formato';

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
