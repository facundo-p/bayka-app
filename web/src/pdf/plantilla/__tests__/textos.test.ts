import { encabezadoDePlantacion, textoPiePagina } from '../textos';

const PLANTACION = { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' };

test('encabezado con lugar · período y el detalle con la organización', () => {
  expect(encabezadoDePlantacion(PLANTACION, 'Bayka Forestal', '/logo.png')).toEqual({
    logo: '/logo.png',
    titulo: 'San Sebastián · 2025-2026',
    detalle: 'Plantación SS26 · Organización Bayka Forestal',
  });
});

test('sin organización legible el detalle lleva solo el código', () => {
  expect(encabezadoDePlantacion(PLANTACION, null, '/logo.png').detalle).toBe('Plantación SS26');
});

test('pie con fecha de emisión y paginado', () => {
  expect(textoPiePagina('06/10/2026', 2, 3)).toBe('Emitido el 06/10/2026 · Página 2 de 3');
});
