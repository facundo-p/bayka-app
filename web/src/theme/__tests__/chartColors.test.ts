import {
  COLORES_GRAFICOS,
  COLOR_GRAFICO_NN,
  COLOR_GRAFICO_OTRAS,
  COLOR_GRAFICO_GRILLA,
  COLOR_GRAFICO_BARRAS,
  COLOR_GRAFICO_LINEA,
  colorEspeciePorIndice,
} from '../chartColors';

test('la paleta categórica tiene 8 colores hex únicos', () => {
  expect(COLORES_GRAFICOS).toHaveLength(8);
  expect(new Set(COLORES_GRAFICOS).size).toBe(8);
  COLORES_GRAFICOS.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/));
});

test('los colores fijos (NN, otras, grilla) están definidos y son hex válidos', () => {
  [COLOR_GRAFICO_NN, COLOR_GRAFICO_OTRAS, COLOR_GRAFICO_GRILLA].forEach((color) =>
    expect(color).toMatch(/^#[0-9a-f]{6}$/),
  );
});

test('barras usa el primer color de la paleta y línea el segundo', () => {
  expect(COLOR_GRAFICO_BARRAS).toBe(COLORES_GRAFICOS[0]);
  expect(COLOR_GRAFICO_LINEA).toBe(COLORES_GRAFICOS[1]);
});

describe('colorEspeciePorIndice', () => {
  test('mapea índices dentro de rango a la posición correspondiente', () => {
    expect(colorEspeciePorIndice(0)).toBe(COLORES_GRAFICOS[0]);
    expect(colorEspeciePorIndice(3)).toBe(COLORES_GRAFICOS[3]);
  });

  test('es cíclico: da la vuelta al superar el largo de la paleta', () => {
    expect(colorEspeciePorIndice(8)).toBe(COLORES_GRAFICOS[0]);
    expect(colorEspeciePorIndice(9)).toBe(COLORES_GRAFICOS[1]);
    expect(colorEspeciePorIndice(17)).toBe(COLORES_GRAFICOS[1]);
  });
});
