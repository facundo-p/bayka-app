import { textoGenerarFichas, textoSeleccion } from '../seleccionFichas';

describe('textoSeleccion', () => {
  test('ninguno, uno y varios', () => {
    expect(textoSeleccion(0, 50)).toBe('0 árboles seleccionados');
    expect(textoSeleccion(1, 50)).toBe('1 árbol seleccionado');
    expect(textoSeleccion(3, 50)).toBe('3 árboles seleccionados');
  });

  test('toda la página', () => {
    expect(textoSeleccion(50, 50)).toBe('Los 50 árboles de esta página');
    expect(textoSeleccion(12, 12)).toBe('Los 12 árboles de esta página');
  });

  test('una página de un solo árbol queda en singular', () => {
    expect(textoSeleccion(1, 1)).toBe('1 árbol seleccionado');
  });
});

test('textoGenerarFichas lleva la cantidad', () => {
  expect(textoGenerarFichas(3)).toBe('Generar fichas (3)');
});
