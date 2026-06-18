import { formatearFechaCorta, formatearMes } from '../fechas';

// Mediodía UTC: la fecha local coincide en cualquier huso entre -11 y +11.
test('formatea un ISO como dd/mm/aaaa en es-AR', () => {
  expect(formatearFechaCorta('2026-06-12T12:00:00Z')).toBe('12/06/2026');
});

test('rellena día y mes con cero a la izquierda', () => {
  expect(formatearFechaCorta('2025-01-05T12:00:00Z')).toBe('05/01/2025');
});

test('formatea un mes YYYY-MM como mes corto + año', () => {
  expect(formatearMes('2026-06')).toBe('jun 2026');
  expect(formatearMes('2026-01')).toBe('ene 2026');
});

test('el huso horario no corre el mes (ancla en UTC)', () => {
  expect(formatearMes('2026-12')).toBe('dic 2026');
});
