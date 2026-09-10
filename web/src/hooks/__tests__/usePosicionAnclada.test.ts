import { calcularPosicion, varsPosicionAnclada } from '../usePosicionAnclada';

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

test('varsPosicionAnclada pasa la posición a variables CSS en px, y el lado sin anclar a auto', () => {
  const posicion = { arriba: 148, abajo: null, izquierda: 20, ancho: 300, altoMaximo: 612 };
  expect(varsPosicionAnclada(posicion)).toEqual({
    '--arriba': '148px',
    '--abajo': 'auto',
    '--izquierda': '20px',
    '--ancho': '300px',
    '--alto-disponible': '612px',
  });
});
