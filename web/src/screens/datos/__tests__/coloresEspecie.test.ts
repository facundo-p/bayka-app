import { describe, expect, test } from 'vitest';
import { colorPuntoEspecie } from '../coloresEspecie';
import { COLOR_GRAFICO_NN, COLORES_GRAFICOS } from '../../../theme/chartColors';
import { ESPECIE_SIN_IDENTIFICAR } from '../../../queries/especiesConstantes';

describe('colorPuntoEspecie', () => {
  test('null y N/N usan el ámbar de "sin identificar"', () => {
    expect(colorPuntoEspecie(null)).toBe(COLOR_GRAFICO_NN);
    expect(colorPuntoEspecie(ESPECIE_SIN_IDENTIFICAR)).toBe(COLOR_GRAFICO_NN);
  });

  test('un código identificado usa un color de la paleta categórica', () => {
    expect(COLORES_GRAFICOS).toContain(colorPuntoEspecie('QB'));
    expect(colorPuntoEspecie('QB')).not.toBe(COLOR_GRAFICO_NN);
  });

  test('es determinístico: el mismo código siempre cae en el mismo color', () => {
    expect(colorPuntoEspecie('IBI')).toBe(colorPuntoEspecie('IBI'));
  });

  test('el color sale del hash (suma de char codes) módulo la paleta', () => {
    const hash = [...'LAP'].reduce((suma, caracter) => suma + caracter.charCodeAt(0), 0);
    expect(colorPuntoEspecie('LAP')).toBe(COLORES_GRAFICOS[hash % COLORES_GRAFICOS.length]);
  });
});
