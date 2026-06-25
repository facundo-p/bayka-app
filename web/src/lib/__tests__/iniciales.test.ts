import { iniciales } from '../iniciales';

test('toma la primera letra de las dos primeras palabras en mayúscula', () => {
  expect(iniciales('Mariana Rivas')).toBe('MR');
});

test('con un solo nombre devuelve una inicial', () => {
  expect(iniciales('Ana')).toBe('A');
});

test('ignora palabras extra más allá de las dos primeras', () => {
  expect(iniciales('Juan Carlos Pérez')).toBe('JC');
});

test('tolera espacios múltiples y bordes', () => {
  expect(iniciales('  ana   admin ')).toBe('AA');
});

test('cadena vacía devuelve cadena vacía', () => {
  expect(iniciales('')).toBe('');
});
