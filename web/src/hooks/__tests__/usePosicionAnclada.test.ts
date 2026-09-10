import { calcularPosicion } from '../usePosicionAnclada';

const ALTO_VIEWPORT = 768;

test('con lugar debajo, se ancla bajo el disparador con su mismo ancho', () => {
  const ancla = { top: 100, bottom: 144, left: 20, width: 300 };
  expect(calcularPosicion(ancla, ALTO_VIEWPORT)).toEqual({
    arriba: 148,
    abajo: null,
    izquierda: 20,
    ancho: 300,
    altoMaximo: 612,
  });
});

test('sin lugar debajo y con más arriba, se abre hacia arriba', () => {
  const ancla = { top: 600, bottom: 644, left: 20, width: 300 };
  expect(calcularPosicion(ancla, ALTO_VIEWPORT)).toEqual({
    arriba: null,
    abajo: 172,
    izquierda: 20,
    ancho: 300,
    altoMaximo: 588,
  });
});

test('poco lugar en ambos lados: se queda abajo si ahí hay más', () => {
  const ancla = { top: 150, bottom: 194, left: 0, width: 200 };
  const posicion = calcularPosicion(ancla, 400);
  expect(posicion.arriba).toBe(198);
  expect(posicion.altoMaximo).toBe(194);
});
