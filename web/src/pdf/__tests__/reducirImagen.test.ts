import { recorteCubriendo } from '../reducirImagen';

const CUATRO_TERCIOS = 4 / 3;

test('una foto vertical se recorta arriba y abajo', () => {
  expect(recorteCubriendo(300, 400, CUATRO_TERCIOS)).toEqual({
    x: 0,
    y: 87.5,
    ancho: 300,
    alto: 225,
  });
});

test('una foto panorámica se recorta a los costados', () => {
  expect(recorteCubriendo(1600, 900, CUATRO_TERCIOS)).toEqual({
    x: 200,
    y: 0,
    ancho: 1200,
    alto: 900,
  });
});

test('con la misma proporción no recorta', () => {
  expect(recorteCubriendo(640, 480, CUATRO_TERCIOS)).toEqual({ x: 0, y: 0, ancho: 640, alto: 480 });
});

const CUADRADA = 1;

test('una foto 4:3 vieja se recorta al centro para el recuadro cuadrado', () => {
  expect(recorteCubriendo(640, 480, CUADRADA)).toEqual({ x: 80, y: 0, ancho: 480, alto: 480 });
});

test('una foto cuadrada entra entera en el recuadro cuadrado', () => {
  expect(recorteCubriendo(1080, 1080, CUADRADA)).toEqual({ x: 0, y: 0, ancho: 1080, alto: 1080 });
});
