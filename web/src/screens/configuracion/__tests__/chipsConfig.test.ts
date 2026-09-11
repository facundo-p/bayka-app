import { chipEspecies, chipTecnicos } from '../chipsConfig';

test.each([
  [0, '0 habilitadas · 14 en catálogo'],
  [1, '1 habilitada · 14 en catálogo'],
  [2, '2 habilitadas · 14 en catálogo'],
])('chip de especies con %i habilitadas: "%s"', (habilitadas, texto) => {
  expect(chipEspecies(habilitadas, 14)).toBe(texto);
});

test('chip de especies: las dos cifras con separador de miles', () => {
  expect(chipEspecies(1000, 1200)).toBe('1.000 habilitadas · 1.200 en catálogo');
});

test.each([
  [0, '0 asignados'],
  [1, '1 asignado'],
  [2, '2 asignados'],
  [1000, '1.000 asignados'],
])('chip de técnicos con %i: "%s"', (asignados, texto) => {
  expect(chipTecnicos(asignados)).toBe(texto);
});
