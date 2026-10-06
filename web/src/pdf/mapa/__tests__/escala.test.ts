import { barraDeEscala, distanciaRedonda, textoDistancia } from '../escala';
import { encuadrar } from '../proyeccion';

describe('distanciaRedonda', () => {
  test.each([
    [73, 50],
    [50, 50],
    [49.9, 20],
    [1, 1],
    [2.5, 2],
    [999, 500],
    [1200, 1000],
    [0.7, 0.5],
  ])('para %f m da %f m', (maximo, esperado) => {
    expect(distanciaRedonda(maximo)).toBeCloseTo(esperado, 9);
  });
});

describe('textoDistancia', () => {
  test('metros hasta 999 y km desde 1000, con coma decimal', () => {
    expect(textoDistancia(50)).toBe('50 m');
    expect(textoDistancia(1000)).toBe('1 km');
    expect(textoDistancia(2500)).toBe('2,5 km');
  });
});

describe('barraDeEscala', () => {
  test('una distancia redonda que no pasa del largo máximo', () => {
    const encuadre = encuadrar([{ lat: -27.36, lng: -55.89 }], 128, 128, {
      margen: 10,
      minimoMetros: 60,
    });
    const barra = barraDeEscala(encuadre, 128 / 3);
    expect(barra.largo).toBeLessThanOrEqual(128 / 3);
    expect(barra.largo).toBeGreaterThan(128 / 3 / 2.5);
    expect(barra.texto).toBe('20 m');
  });
});
