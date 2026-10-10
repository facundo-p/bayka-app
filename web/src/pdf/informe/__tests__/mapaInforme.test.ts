import type { PuntoGps } from '../../../queries/mapaQueries';
import { dibujarMapa } from '../../mapa/dibujarMapa';
import { planificarMapa } from '../../mapa/planMapa';
import { CUERPO_HOJA } from '../../plantilla/tokens';
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

  /** Lo que recibió el canvas, encuadrado como lo encuadra él. */
  async function dibujado(puntos: typeof contenido.puntos) {
    const { caja } = await dibujarMapaInforme({ puntos, etiquetas: [] });
    const opciones = vi.mocked(dibujarMapa).mock.calls[0][0];
    return { caja, opciones, plan: planificarMapa(opciones) };
  }

  test('dibuja en JPEG, con margen interior y el radio según la densidad', async () => {
    const { mapa } = await dibujarMapaInforme(contenido);
    expect(mapa).toEqual({ estado: 'listo', src: 'data:image/jpeg;base64,M', conSatelite: true });
    expect(vi.mocked(dibujarMapa).mock.calls[0][0]).toMatchObject({
      formato: { tipo: 'image/jpeg' },
      margen: 24,
      radioPunto: 4,
      fondo: expect.any(Function),
    });
  });

  test('un solo punto sale en 16:9 horizontal, al ancho del cuerpo', async () => {
    const { caja, opciones } = await dibujado(contenido.puntos);
    expect(caja.ancho).toBe(CUERPO_HOJA.ancho);
    expect(caja.ancho / caja.alto).toBeCloseTo(16 / 9);
    expect(opciones).toMatchObject(caja);
  });

  test('una plantación alargada en vertical sale en 16:9 con todos los puntos adentro', async () => {
    const alta = Array.from({ length: 20 }, (_, i) => ({
      lat: -27.4 - i * 0.003,
      lng: -55.9 + (i % 2) * 0.0005,
      color,
    }));
    const { caja, plan } = await dibujado(alta);
    expect(caja.ancho / caja.alto).toBeCloseTo(16 / 9);
    for (const { x, y } of plan!.puntos) {
      expect(x).toBeGreaterThanOrEqual(24 - 1e-6);
      expect(x).toBeLessThanOrEqual(caja.ancho - 24 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(24 - 1e-6);
      expect(y).toBeLessThanOrEqual(caja.alto - 24 + 1e-6);
    }
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
