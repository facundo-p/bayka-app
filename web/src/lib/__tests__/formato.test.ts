import { formatearEntero } from '../formato';

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
