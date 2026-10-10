import { describe, expect, test } from 'vitest';
import { colorEspeciePorCodigo, coloresDeEspecies, PALETA_ESPECIES } from '../coloresEspecie';
import { COLOR_GRAFICO_NN, COLOR_GRAFICO_OTRAS, COLORES_GRAFICOS } from '../chartColors';
import { ESPECIE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';

const PALETA = [
  '#0a3760',
  '#99b95b',
  '#3b7db5',
  '#6b8f3c',
  '#1a5a8a',
  '#b3cf7e',
  '#0e4573',
  '#a8c465',
  '#7d4e7a',
  '#3e8a85',
  '#b0623a',
  '#5b6b7c',
];

const especie = (codigo: string, lugarColor: number | null) => ({ codigo, lugarColor });

test('la paleta de especies son los 8 de los gráficos y los 4 extra, sin repetir', () => {
  expect(PALETA_ESPECIES).toEqual(PALETA);
  expect(new Set(PALETA_ESPECIES).size).toBe(12);
});

describe('colorEspeciePorCodigo', () => {
  test('null y N/N usan el ámbar de "sin identificar"', () => {
    expect(colorEspeciePorCodigo(null)).toBe(COLOR_GRAFICO_NN);
    expect(colorEspeciePorCodigo(ESPECIE_SIN_IDENTIFICAR)).toBe(COLOR_GRAFICO_NN);
  });

  test('un código identificado usa un color de la paleta categórica', () => {
    expect(COLORES_GRAFICOS).toContain(colorEspeciePorCodigo('QB'));
    expect(colorEspeciePorCodigo('QB')).not.toBe(COLOR_GRAFICO_NN);
  });

  test('es determinístico: el mismo código siempre cae en el mismo color', () => {
    expect(colorEspeciePorCodigo('IBI')).toBe(colorEspeciePorCodigo('IBI'));
  });

  test('el color sale del hash (suma de char codes) módulo la paleta', () => {
    const hash = [...'LAP'].reduce((suma, caracter) => suma + caracter.charCodeAt(0), 0);
    expect(colorEspeciePorCodigo('LAP')).toBe(COLORES_GRAFICOS[hash % COLORES_GRAFICOS.length]);
  });
});

describe('coloresDeEspecies', () => {
  test('ANC y TIM, que el hash pintaba igual, quedan con colores distintos (#777)', () => {
    expect(colorEspeciePorCodigo('ANC')).toBe(colorEspeciePorCodigo('TIM'));
    const color = coloresDeEspecies([especie('TIM', 0), especie('ANC', 1)]);
    expect(color('ANC')).not.toBe(color('TIM'));
  });

  test('el color sale del lugar de la especie en la paleta, no del orden de los códigos', () => {
    const color = coloresDeEspecies([especie('TIM', 0), especie('ANC', 2), especie('LAP', 1)]);
    expect(color('TIM')).toBe('#0a3760');
    expect(color('LAP')).toBe('#99b95b');
    expect(color('ANC')).toBe('#3b7db5');
  });

  test('habilitar una especie de código intermedio no le cambia el color a ninguna (#845)', () => {
    const antes = coloresDeEspecies([especie('ANC', 0), especie('TIM', 1)]);
    const despues = coloresDeEspecies([especie('ANC', 0), especie('LAP', 2), especie('TIM', 1)]);
    expect(despues('ANC')).toBe(antes('ANC'));
    expect(despues('TIM')).toBe(antes('TIM'));
  });

  test('del lugar 8 al 11 usa los 4 colores extra', () => {
    const color = coloresDeEspecies([especie('E08', 8), especie('E11', 11)]);
    expect(color('E08')).toBe('#7d4e7a');
    expect(color('E11')).toBe('#5b6b7c');
  });

  test('el lugar 12 repite el color del 0', () => {
    expect(coloresDeEspecies([especie('E12', 12)])('E12')).toBe('#0a3760');
  });

  test('null y N/N son ámbar', () => {
    const color = coloresDeEspecies([especie(ESPECIE_SIN_IDENTIFICAR, null), especie('ANC', 0)]);
    expect(color(null)).toBe(COLOR_GRAFICO_NN);
    expect(color(ESPECIE_SIN_IDENTIFICAR)).toBe(COLOR_GRAFICO_NN);
    expect(color('ANC')).toBe('#0a3760');
  });

  test('un código que no está habilitado va en gris', () => {
    expect(coloresDeEspecies([especie('ANC', 0)])('XYZ')).toBe(COLOR_GRAFICO_OTRAS);
  });

  test('una especie habilitada sin lugar legible se pinta por su hash', () => {
    const color = coloresDeEspecies([especie('ANC', null), especie('TIM', 0)]);
    expect(color('ANC')).toBe(colorEspeciePorCodigo('ANC'));
    expect(color('TIM')).toBe('#0a3760');
  });
});
