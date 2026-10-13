import { medianaAlVecino, radioSegunVecinos } from '../vecinos';

const grilla = (filas: number, columnas: number, paso: number, desde = { x: 0, y: 0 }) =>
  Array.from({ length: filas * columnas }, (_, i) => ({
    x: desde.x + (i % columnas) * paso,
    y: desde.y + Math.floor(i / columnas) * paso,
  }));

test('en una grilla regular es el paso de la grilla', () => {
  expect(medianaAlVecino(grilla(10, 10, 6))).toBe(6);
});

test('bloques separados dan lo mismo que uno solo: el vacío entre ellos no cuenta', () => {
  const bloques = [
    ...grilla(10, 10, 6),
    ...grilla(10, 10, 6, { x: 500, y: 0 }),
    ...grilla(10, 10, 6, { x: 0, y: 400 }),
  ];
  expect(medianaAlVecino(bloques)).toBe(6);
});

test('con muestra, la misma respuesta en una grilla grande', () => {
  expect(medianaAlVecino(grilla(80, 100, 2), 400)).toBe(2);
});

describe('radioSegunVecinos', () => {
  const TOPES = { minimo: 0.5, maximo: 3 };

  test('0,35 de la separación entre vecinos', () => {
    expect(radioSegunVecinos(grilla(10, 10, 6), TOPES)).toBeCloseTo(2.1);
  });

  test('acotado entre los dos topes', () => {
    expect(radioSegunVecinos(grilla(10, 10, 1), TOPES)).toBe(0.5);
    expect(radioSegunVecinos(grilla(3, 3, 40), TOPES)).toBe(3);
  });

  test('sin vecinos, el máximo', () => {
    expect(radioSegunVecinos([{ x: 1, y: 1 }], TOPES)).toBe(3);
    expect(radioSegunVecinos([], TOPES)).toBe(3);
  });
});

test('un punto solo, o todos en el mismo lugar, no tienen vecino', () => {
  expect(medianaAlVecino([{ x: 1, y: 1 }])).toBeNull();
  expect(
    medianaAlVecino([
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ]),
  ).toBeNull();
});
