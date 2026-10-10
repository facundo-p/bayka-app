import { arbolDetalle } from '../../../test/fabricas';
import {
  codigoParcelaDe,
  etiquetaEspecie,
  nombreTecnicoDe,
  parcelaDe,
  textoCoordenadas,
  textoPrecisionGps,
  tieneGps,
  urlGoogleMaps,
  type ArbolConGps,
} from '../arbolFormato';

/** Sin especie ni GPS; parcela y técnico con entrada en los lookups. */
const ARBOL = arbolDetalle({
  especieCodigo: null,
  especieNombre: null,
  parcelaId: 'parc-1',
  usuarioRegistro: 'user-1',
});

test('sin especie la etiqueta es N/N · Sin identificar', () => {
  expect(etiquetaEspecie(ARBOL)).toBe('N/N · Sin identificar');
  expect(etiquetaEspecie({ ...ARBOL, especieCodigo: 'QB', especieNombre: 'Quebracho' })).toBe(
    'QB · Quebracho',
  );
});

test('tieneGps exige las dos coordenadas', () => {
  expect(tieneGps(ARBOL)).toBe(false);
  expect(tieneGps({ ...ARBOL, latitude: -27.1 })).toBe(false);
  expect(tieneGps({ ...ARBOL, latitude: 0, longitude: 0 })).toBe(true);
});

test('los lookups devuelven null sin id, sin entrada o con nombre vacío', () => {
  const codigos = new Map([['parc-1', 'P1']]);
  const nombres = new Map([
    ['user-1', 'Ana'],
    ['user-2', ''],
  ]);
  expect(codigoParcelaDe(ARBOL, codigos)).toBe('P1');
  expect(codigoParcelaDe({ ...ARBOL, parcelaId: null }, codigos)).toBeNull();
  expect(codigoParcelaDe({ ...ARBOL, parcelaId: 'otra' }, codigos)).toBeNull();
  expect(nombreTecnicoDe(ARBOL, nombres)).toBe('Ana');
  expect(nombreTecnicoDe({ ...ARBOL, usuarioRegistro: null }, nombres)).toBeNull();
  expect(nombreTecnicoDe({ ...ARBOL, usuarioRegistro: 'user-2' }, nombres)).toBeNull();
});

test('parcelaDe devuelve la entrada de la parcela del árbol', () => {
  const parcelas = new Map([['parc-1', { codigo: 'P1', nombre: 'Norte' }]]);
  expect(parcelaDe(ARBOL, parcelas)).toEqual({ codigo: 'P1', nombre: 'Norte' });
  expect(parcelaDe({ ...ARBOL, parcelaId: null }, parcelas)).toBeNull();
  expect(parcelaDe({ ...ARBOL, parcelaId: 'otra' }, parcelas)).toBeNull();
});

describe('GPS del detalle (#830)', () => {
  const CON_GPS: ArbolConGps = {
    ...ARBOL,
    latitude: -27.36012,
    longitude: -55.89744,
    gpsAccuracy: 4.2,
  };

  test('coordenadas con 6 decimales, como la ficha', () => {
    expect(textoCoordenadas(CON_GPS)).toBe('-27.360120, -55.897440');
  });

  test('precisión redondeada en metros, o null si no se informó', () => {
    expect(textoPrecisionGps(CON_GPS)).toBe('± 4 m');
    expect(textoPrecisionGps({ ...CON_GPS, gpsAccuracy: undefined })).toBeNull();
  });

  test('el enlace de Google Maps busca el punto exacto', () => {
    expect(urlGoogleMaps(CON_GPS)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-27.36012,-55.89744',
    );
  });
});
