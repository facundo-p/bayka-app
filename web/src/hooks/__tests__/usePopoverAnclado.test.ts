import { LADO_PANEL, ladoQueEntra } from '../usePopoverAnclado';

const ANCHO_PANEL = 390;

test('con lugar a la derecha del disparador, se alinea por la izquierda', () => {
  expect(ladoQueEntra({ left: 320 }, ANCHO_PANEL, 1366)).toBe(LADO_PANEL.izquierda);
});

test('si no entra hacia la derecha, se alinea por la derecha del disparador', () => {
  expect(ladoQueEntra({ left: 320 }, ANCHO_PANEL, 640)).toBe(LADO_PANEL.derecha);
});

test('deja el margen de la ventana libre: justo en el borde ya no entra', () => {
  expect(ladoQueEntra({ left: 370 }, ANCHO_PANEL, 768)).toBe(LADO_PANEL.izquierda);
  expect(ladoQueEntra({ left: 371 }, ANCHO_PANEL, 768)).toBe(LADO_PANEL.derecha);
});
