import type { PuntoGps } from '../../../queries/mapaQueries';
import { dibujarMapa } from '../../mapa/dibujarMapa';
import { planificarMapa } from '../../mapa/planMapa';
import { CUERPO_HOJA, MEDIDA_INFORME } from '../../plantilla/tokens';
import { dibujarMapaInforme, etiquetasDeParcelas, radioDePuntos } from '../mapaInforme';

vi.mock('../../mapa/dibujarMapa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../mapa/dibujarMapa')>()),
  dibujarMapa: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

function punto(lat: number, lng: number, parcelaId: string | null): PuntoGps {
  return { lat, lng, parcelaId, codigo: 'LAP', nombre: '', idArbol: 'x', subId: 'x' };
}

describe('etiquetasDeParcelas', () => {
  test('pone el código de cada parcela en el centro de sus puntos', () => {
    const puntos = [punto(-27, -55, 'a'), punto(-27.2, -55.4, 'a'), punto(-28, -56, 'b')];
    const parcelas = [
      { id: 'a', codigo: 'LP12' },
      { id: 'b', codigo: 'BA03' },
    ];
    const etiquetas = etiquetasDeParcelas(puntos, parcelas);
    expect(etiquetas).toHaveLength(2);
    expect(etiquetas[0].texto).toBe('LP12');
    expect(etiquetas[0].lat).toBeCloseTo(-27.1);
    expect(etiquetas[0].lng).toBeCloseTo(-55.2);
    expect(etiquetas[1]).toEqual({ lat: -28, lng: -56, texto: 'BA03' });
  });

  test('sin puntos la parcela no lleva etiqueta, y un punto sin parcela no cuenta', () => {
    const puntos = [punto(-27, -55, null), punto(-27, -55, 'a')];
    const parcelas = [
      { id: 'a', codigo: 'LP12' },
      { id: 'c', codigo: 'CN07' },
    ];
    expect(etiquetasDeParcelas(puntos, parcelas).map((etiqueta) => etiqueta.texto)).toEqual([
      'LP12',
    ]);
  });
});

describe('radioDePuntos', () => {
  const grilla = (paso: number, desde = 0) =>
    Array.from({ length: 100 }, (_, i) => ({
      x: desde + (i % 10) * paso,
      y: Math.floor(i / 10) * paso,
    }));

  test('una fracción de la separación entre vecinos', () => {
    expect(radioDePuntos(grilla(6))).toBeCloseTo(2.1);
  });

  test('bloques separados dan el mismo radio que uno solo', () => {
    expect(radioDePuntos([...grilla(6), ...grilla(6, 400)])).toBe(radioDePuntos(grilla(6)));
  });

  test('entre el mínimo y el máximo', () => {
    expect(radioDePuntos(grilla(1))).toBe(1.1);
    expect(radioDePuntos(grilla(100))).toBe(4);
    expect(radioDePuntos([{ x: 0, y: 0 }])).toBe(4);
  });
});

describe('dibujarMapaInforme', () => {
  const color = '#000';
  const contenido = { puntos: [{ lat: -27.47, lng: -55.9, color }], etiquetas: [] };

  beforeEach(() => {
    vi.mocked(dibujarMapa).mockResolvedValue({ src: 'data:image/jpeg;base64,M', conFondo: true });
  });

  const MARGEN = MEDIDA_INFORME.margenMapa;
  const TOLERANCIA = 1e-6;

  /** Lo que recibió el canvas, encuadrado como lo encuadra él. */
  async function dibujado(puntos: typeof contenido.puntos) {
    await dibujarMapaInforme({ puntos, etiquetas: [] });
    const opciones = vi.mocked(dibujarMapa).mock.calls[0][0];
    return { opciones, ubicados: planificarMapa(opciones)!.puntos };
  }

  /** 16:9 al ancho del cuerpo, con cada punto dentro del margen. */
  async function esperarEncuadrado(puntos: typeof contenido.puntos) {
    const { opciones, ubicados } = await dibujado(puntos);
    expect(opciones.ancho).toBe(CUERPO_HOJA.ancho);
    expect(opciones.ancho / opciones.alto).toBeCloseTo(16 / 9);
    expect(ubicados).toHaveLength(puntos.length);
    for (const { x, y } of ubicados) {
      expect(x).toBeGreaterThanOrEqual(MARGEN - TOLERANCIA);
      expect(x).toBeLessThanOrEqual(opciones.ancho - MARGEN + TOLERANCIA);
      expect(y).toBeGreaterThanOrEqual(MARGEN - TOLERANCIA);
      expect(y).toBeLessThanOrEqual(opciones.alto - MARGEN + TOLERANCIA);
    }
  }

  type Paso = { lat: number; lng: number };

  /** 20 puntos en línea; uno de cada dos corrido en `desvio`, para no quedar en una recta. */
  const enLinea = (paso: Paso, desvio: Paso) =>
    Array.from({ length: 20 }, (_, i) => ({
      lat: -27.4 + i * paso.lat + (i % 2) * desvio.lat,
      lng: -55.9 + i * paso.lng + (i % 2) * desvio.lng,
      color,
    }));

  test('dibuja en JPEG, con margen interior y el radio según la densidad', async () => {
    const { mapa } = await dibujarMapaInforme(contenido);
    expect(mapa).toEqual({ estado: 'listo', src: 'data:image/jpeg;base64,M', conSatelite: true });
    expect(vi.mocked(dibujarMapa).mock.calls[0][0]).toMatchObject({
      formato: { tipo: 'image/jpeg' },
      margen: MARGEN,
      radioPunto: 4,
      fondo: expect.any(Function),
    });
  });

  test('un solo punto sale en 16:9 horizontal, al ancho del cuerpo', async () => {
    await esperarEncuadrado(contenido.puntos);
  });

  test('puntos idénticos también', async () => {
    await esperarEncuadrado([...contenido.puntos, ...contenido.puntos]);
  });

  test('una plantación alargada en vertical sale en 16:9 con todos los puntos adentro', async () => {
    await esperarEncuadrado(enLinea({ lat: -0.003, lng: 0 }, { lat: 0, lng: 0.0005 }));
  });

  test('una plantación más apaisada que 16:9 también', async () => {
    await esperarEncuadrado(enLinea({ lat: 0, lng: 0.003 }, { lat: 0.0005, lng: 0 }));
  });

  test('sin puntos no dibuja nada', async () => {
    const { mapa } = await dibujarMapaInforme({ puntos: [], etiquetas: [] });
    expect(mapa.estado).toBe('sin-gps');
    expect(dibujarMapa).not.toHaveBeenCalled();
  });

  test('si el canvas falla o no devuelve imagen, el mapa no está disponible', async () => {
    vi.mocked(dibujarMapa).mockRejectedValueOnce(new Error('canvas'));
    expect((await dibujarMapaInforme(contenido)).mapa.estado).toBe('no-disponible');
    vi.mocked(dibujarMapa).mockResolvedValueOnce(null);
    expect((await dibujarMapaInforme(contenido)).mapa.estado).toBe('no-disponible');
  });
});
