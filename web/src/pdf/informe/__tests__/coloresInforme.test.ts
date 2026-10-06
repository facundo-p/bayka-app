import { asignarColoresInforme, PALETA_INFORME } from '../coloresInforme';

const especies = (codigos: string[]) => codigos.map((codigo) => ({ codigo }));

test('la paleta del informe son los 8 de los gráficos y los 4 extra', () => {
  expect(PALETA_INFORME).toHaveLength(12);
  expect(PALETA_INFORME.slice(8)).toEqual(['#7d4e7a', '#3e8a85', '#b0623a', '#5b6b7c']);
  expect(new Set(PALETA_INFORME).size).toBe(12);
});

test('asigna por orden de cantidad, sin repetir hasta la especie 12', () => {
  const codigos = Array.from({ length: 12 }, (_, i) => `E${i}`);
  const color = asignarColoresInforme(especies(codigos));
  expect(codigos.map(color)).toEqual([...PALETA_INFORME]);
});

test('con más de 12 especies cicla la paleta', () => {
  const codigos = Array.from({ length: 14 }, (_, i) => `E${i}`);
  const color = asignarColoresInforme(especies(codigos));
  expect(color('E12')).toBe(PALETA_INFORME[0]);
  expect(color('E13')).toBe(PALETA_INFORME[1]);
});

test('N/N va siempre en ámbar y no consume un color', () => {
  const color = asignarColoresInforme(especies(['LAP', 'NN', 'TIM']));
  expect(color('NN')).toBe('#e0a83b');
  expect(color('LAP')).toBe(PALETA_INFORME[0]);
  expect(color('TIM')).toBe(PALETA_INFORME[1]);
});

test('un código que no está en los conteos va en gris', () => {
  expect(asignarColoresInforme(especies(['LAP']))('XYZ')).toBe('#64748b');
});
