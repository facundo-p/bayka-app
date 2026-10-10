import { describe, expect, test } from 'vitest';
import { colorEspeciePorCodigo, coloresDeEspecies } from '../coloresEspecie';
import { COLOR_GRAFICO_NN, COLOR_GRAFICO_OTRAS, COLORES_GRAFICOS } from '../chartColors';
import { ESPECIE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';

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
    const color = coloresDeEspecies(['TIM', 'ANC']);
    expect(color('ANC')).not.toBe(color('TIM'));
  });

  test('el color sale del índice en el catálogo ordenado por código', () => {
    const color = coloresDeEspecies(['TIM', 'ANC', 'LAP']);
    expect(color('ANC')).toBe('#0a3760');
    expect(color('LAP')).toBe('#99b95b');
    expect(color('TIM')).toBe('#3b7db5');
  });

  test('no depende del orden ni de repetidos en la entrada', () => {
    const una = coloresDeEspecies(['ANC', 'TIM', 'LAP']);
    const otra = coloresDeEspecies(['LAP', 'TIM', 'ANC', 'TIM']);
    for (const codigo of ['ANC', 'TIM', 'LAP']) expect(otra(codigo)).toBe(una(codigo));
  });

  test('de la novena a la duodécima especie usa los 4 colores extra', () => {
    const codigos = Array.from(
      { length: 12 },
      (_, indice) => `E${String(indice).padStart(2, '0')}`,
    );
    const color = coloresDeEspecies(codigos);
    expect(new Set(codigos.map(color)).size).toBe(12);
    expect(color('E08')).toBe('#7d4e7a');
    expect(color('E11')).toBe('#5b6b7c');
  });

  test('con más de 12 especies vuelve a empezar la paleta', () => {
    const codigos = Array.from(
      { length: 13 },
      (_, indice) => `E${String(indice).padStart(2, '0')}`,
    );
    expect(coloresDeEspecies(codigos)('E12')).toBe('#0a3760');
  });

  test('null y N/N son ámbar y N/N no consume un color de la paleta', () => {
    const color = coloresDeEspecies([ESPECIE_SIN_IDENTIFICAR, 'ANC']);
    expect(color(null)).toBe(COLOR_GRAFICO_NN);
    expect(color(ESPECIE_SIN_IDENTIFICAR)).toBe(COLOR_GRAFICO_NN);
    expect(color('ANC')).toBe('#0a3760');
  });

  test('un código fuera del catálogo va en gris', () => {
    expect(coloresDeEspecies(['ANC'])('XYZ')).toBe(COLOR_GRAFICO_OTRAS);
  });
});
