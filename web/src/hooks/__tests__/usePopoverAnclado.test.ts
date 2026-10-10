import { LADO_PANEL, ubicarPanel } from '../usePopoverAnclado';

const ANCHO_PANEL = 390;
const ANCHO_BOTON = 84;

function boton(left: number) {
  return { left, right: left + ANCHO_BOTON };
}

test('con lugar a la derecha del disparador, se alinea por la izquierda', () => {
  expect(ubicarPanel(boton(320), ANCHO_PANEL, 1366)).toEqual({
    lado: LADO_PANEL.izquierda,
    desvio: 0,
  });
});

test('si no entra hacia la derecha, se alinea por la derecha del disparador', () => {
  expect(ubicarPanel(boton(320), ANCHO_PANEL, 640)).toEqual({
    lado: LADO_PANEL.derecha,
    desvio: 0,
  });
});

test('deja el margen de la ventana libre: justo en el borde ya no entra', () => {
  expect(ubicarPanel(boton(370), ANCHO_PANEL, 768).lado).toBe(LADO_PANEL.izquierda);
  expect(ubicarPanel(boton(371), ANCHO_PANEL, 768).lado).toBe(LADO_PANEL.derecha);
});

test('si no entra hacia ningún lado, se corre lo justo para dejar el margen', () => {
  // Usuarios a 601px: el panel de 420 alineado por la derecha arrancaba en -16.
  const usuarios = { left: 320, right: 404 };
  const { lado, desvio } = ubicarPanel(usuarios, 420, 601);
  expect(lado).toBe(LADO_PANEL.derecha);
  expect(usuarios.right - 420 + desvio).toBe(8);
});
