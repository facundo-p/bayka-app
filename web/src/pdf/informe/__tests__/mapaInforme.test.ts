import type { PuntoGps } from '../../../queries/mapaQueries';
import { dibujarMapa } from '../../mapa/dibujarMapa';
import {
  cajaDelMapa,
  dibujarMapaInforme,
  etiquetasDeParcelas,
  radioDePuntos,
} from '../mapaInforme';

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

describe('cajaDelMapa', () => {
  const DISPONIBLE = { ancho: 535, alto: 400 };
  const color = '#000';

  test('una plantación ancha ocupa todo el ancho y achica el alto', () => {
    const ancha = [
      { lat: -27.47, lng: -55.9, color },
      { lat: -27.471, lng: -55.85, color },
    ];
    const caja = cajaDelMapa(ancha, DISPONIBLE);
    expect(caja.ancho).toBe(535);
    expect(caja.alto).toBeLessThan(400);
  });

  test('una plantación alta ocupa todo el alto y achica el ancho', () => {
    const alta = [
      { lat: -27.4, lng: -55.9, color },
      { lat: -27.45, lng: -55.901, color },
    ];
    const caja = cajaDelMapa(alta, DISPONIBLE);
    expect(caja.alto).toBe(400);
    expect(caja.ancho).toBeLessThan(535);
  });
});

describe('radioDePuntos', () => {
  const HOJA = { ancho: 535, alto: 560 };

  test('con miles de puntos, el radio mínimo', () => {
    expect(radioDePuntos(7800, HOJA)).toBe(1.1);
  });

  test('con pocos, el máximo', () => {
    expect(radioDePuntos(6, HOJA)).toBe(4);
  });

  test('en el medio crece cuanto menos puntos hay', () => {
    const intermedio = radioDePuntos(1500, HOJA);
    expect(intermedio).toBeGreaterThan(1.1);
    expect(intermedio).toBeLessThan(4);
    expect(radioDePuntos(1000, HOJA)).toBeGreaterThan(intermedio);
  });
});

describe('dibujarMapaInforme', () => {
  const contenido = {
    puntos: [{ lat: -27.47, lng: -55.9, color: '#000' }],
    etiquetas: [],
  };
  const DISPONIBLE = { ancho: 535, alto: 400 };

  test('dibuja en JPEG, con margen interior y el radio según la densidad', async () => {
    vi.mocked(dibujarMapa).mockResolvedValue('data:image/jpeg;base64,M');
    const { mapa } = await dibujarMapaInforme(contenido, DISPONIBLE);
    expect(mapa).toEqual({ estado: 'listo', src: 'data:image/jpeg;base64,M' });
    expect(vi.mocked(dibujarMapa).mock.calls[0][0]).toMatchObject({
      formato: { tipo: 'image/jpeg' },
      margen: 24,
      radioPunto: 4,
    });
  });

  test('sin puntos no dibuja nada', async () => {
    const { mapa } = await dibujarMapaInforme({ puntos: [], etiquetas: [] }, DISPONIBLE);
    expect(mapa.estado).toBe('sin-gps');
    expect(dibujarMapa).not.toHaveBeenCalled();
  });

  test('si el canvas falla o no devuelve imagen, el mapa no está disponible', async () => {
    vi.mocked(dibujarMapa).mockRejectedValueOnce(new Error('canvas'));
    expect((await dibujarMapaInforme(contenido, DISPONIBLE)).mapa.estado).toBe('no-disponible');
    vi.mocked(dibujarMapa).mockResolvedValueOnce(null);
    expect((await dibujarMapaInforme(contenido, DISPONIBLE)).mapa.estado).toBe('no-disponible');
  });
});
