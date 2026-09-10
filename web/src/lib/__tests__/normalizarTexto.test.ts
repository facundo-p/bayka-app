import { normalizarTexto } from '../normalizarTexto';

test('pasa a minúsculas y quita acentos y diéresis', () => {
  expect(normalizarTexto('Lucía ÑANDÚ Güemes')).toBe('lucia nandu guemes');
});

test('deja igual un texto sin acentos', () => {
  expect(normalizarTexto('martin@bayka.app')).toBe('martin@bayka.app');
});
