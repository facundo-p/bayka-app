import type { FuenteTiles } from '../fuenteTiles';
import {
  areaConMargen,
  esPuntoUnico,
  extremosDe,
  zoomDeEncuadre,
  zoomDePartida,
  zoomSinChequeo,
} from '../encuadreSatelital';
import type { ZonaTiles } from '../tiles';

/** Fuente con imagen hasta `hastaZoom`; con `falla`, el tilemap no responde. */
function fuente({ hastaZoom = 19, falla = false } = {}) {
  return {
    tieneImagen: vi.fn(async ({ z }: ZonaTiles) => {
      if (falla) throw new Error('red');
      return z <= hastaZoom;
    }),
    cargar: vi.fn(),
  } satisfies FuenteTiles;
}

const AREA = { zoom: 19, origen: { x: 1000, y: 2000 }, ancho: 300, alto: 200 };

describe('extremosDe', () => {
  test('los bordes de todos los puntos', () => {
    const puntos = [
      { lat: -27.36, lng: -55.9 },
      { lat: -27.35, lng: -55.89 },
      { lat: -27.37, lng: -55.895 },
    ];
    expect(extremosDe(puntos)).toEqual({ sur: -27.37, oeste: -55.9, norte: -27.35, este: -55.89 });
  });

  test('varios puntos en la misma coordenada son un punto único', () => {
    const punto = { lat: -27.36, lng: -55.9 };
    expect(esPuntoUnico(extremosDe([punto, { ...punto }]))).toBe(true);
    expect(esPuntoUnico(extremosDe([punto, { ...punto, lng: -55.8 }]))).toBe(false);
  });
});

describe('zoomDePartida', () => {
  test('con área, el zoom en que entran los puntos', () => {
    expect(zoomDePartida(15, false)).toBe(15);
  });

  test('nunca pasa del máximo de la capa', () => {
    expect(zoomDePartida(Infinity, false)).toBe(19);
  });

  test('un punto único arranca en 17, no en 19', () => {
    expect(zoomDePartida(19, true)).toBe(17);
    expect(zoomDePartida(Infinity, true)).toBe(17);
  });

  test('sin zoom calculable (NaN), no hay partida', () => {
    expect(zoomDePartida(NaN, false)).toBeNull();
    expect(zoomDePartida(NaN, true)).toBeNull();
  });

  test('sin chequeo, el tope es 17', () => {
    expect(zoomSinChequeo(19)).toBe(17);
    expect(zoomSinChequeo(14)).toBe(14);
  });
});

test('el área suma el margen de cada lado', () => {
  const caja = { min: { x: 100, y: 200 }, max: { x: 150, y: 260 } };
  expect(areaConMargen(caja, 18, 24)).toEqual({
    zoom: 18,
    origen: { x: 76, y: 176 },
    ancho: 98,
    alto: 108,
  });
});

describe('zoomDeEncuadre', () => {
  test('con imagen al zoom de partida, se queda ahí', async () => {
    expect(await zoomDeEncuadre(AREA, 19, { fuente: fuente() })).toBe(19);
  });

  test('sin imagen, baja hasta el primer zoom que la tiene', async () => {
    const f = fuente({ hastaZoom: 17 });
    expect(await zoomDeEncuadre(AREA, 19, { fuente: f })).toBe(17);
    expect(f.tieneImagen.mock.calls.map(([zona]) => zona.z)).toEqual([19, 18, 17]);
  });

  test('si no hay imagen en ningún zoom revisado, tope 17', async () => {
    expect(await zoomDeEncuadre(AREA, 19, { fuente: fuente({ hastaZoom: 10 }) })).toBe(17);
  });

  test('si el chequeo falla, tope 17', async () => {
    expect(await zoomDeEncuadre(AREA, 19, { fuente: fuente({ falla: true }) })).toBe(17);
  });

  test('si el chequeo tarda más que la espera, tope 17', async () => {
    vi.useFakeTimers();
    const colgada = { tieneImagen: () => new Promise<boolean>(() => {}), cargar: vi.fn() };
    const zoom = zoomDeEncuadre(AREA, 19, { fuente: colgada, esperaMs: 3000 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(await zoom).toBe(17);
    vi.useRealTimers();
  });
});
