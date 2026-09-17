import { coincideBusqueda, normalizarTexto } from '../normalizarTexto';

test('pasa a minúsculas y quita acentos y diéresis', () => {
  expect(normalizarTexto('Lucía ÑANDÚ Güemes')).toBe('lucia nandu guemes');
});

test('deja igual un texto sin acentos', () => {
  expect(normalizarTexto('martin@bayka.app')).toBe('martin@bayka.app');
});

test('coincideBusqueda ignora acentos y mayúsculas de los dos lados', () => {
  expect(coincideBusqueda(['Ir a Configuración…'], 'configuracion')).toBe(true);
  expect(coincideBusqueda(['Pablo Rios'], 'RÍOS')).toBe(true);
});

test('coincideBusqueda alcanza con un texto que coincida, y tolera textos nulos', () => {
  expect(coincideBusqueda(['Lucía Ferreyra', null, 'lferreyra@gmail.com'], 'gmail')).toBe(true);
  expect(coincideBusqueda(['Pablo Ríos', undefined], 'gmail')).toBe(false);
});

test('coincideBusqueda con búsqueda vacía o de solo espacios coincide con todo', () => {
  expect(coincideBusqueda(['Pablo Ríos'], '')).toBe(true);
  expect(coincideBusqueda([], '   ')).toBe(true);
});
