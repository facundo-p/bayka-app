import { encabezadoDePlantacion, textoPiePagina } from '../textos';

const PLANTACION = { lugar: 'San Sebastián', periodo: '2025-2026' };

test('encabezado con lugar · período, sin código ni organización', () => {
  expect(encabezadoDePlantacion(PLANTACION, '/logo.png')).toEqual({
    logo: '/logo.png',
    titulo: 'San Sebastián · 2025-2026',
  });
});

test('pie con fecha de emisión y paginado', () => {
  expect(textoPiePagina('06/10/2026', 2, 3)).toBe('Emitido el 06/10/2026 · Página 2 de 3');
});
