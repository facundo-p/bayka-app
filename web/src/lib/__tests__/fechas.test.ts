import { formatearFechaCorta } from '../fechas';

// Mediodía UTC: la fecha local coincide en cualquier huso entre -11 y +11.
test('formatea un ISO como dd/mm/aaaa en es-AR', () => {
  expect(formatearFechaCorta('2026-06-12T12:00:00Z')).toBe('12/06/2026');
});

test('rellena día y mes con cero a la izquierda', () => {
  expect(formatearFechaCorta('2025-01-05T12:00:00Z')).toBe('05/01/2025');
});
