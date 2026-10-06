import type { PuntoGps } from '../../../queries/mapaQueries';
import { cajaDelMapa, etiquetasDeParcelas } from '../mapaInforme';

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
