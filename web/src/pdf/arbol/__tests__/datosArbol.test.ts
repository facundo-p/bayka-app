import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { COLOR_GRAFICO_NN } from '../../../theme/chartColors';
import { datosArbol, especieArbol, gpsArbol } from '../datosArbol';

const ANCHICO = {
  codigo: 'ANC',
  nombre: 'Anchico',
  nombreCientifico: 'Parapiptadenia rigida',
  tipo: 'flora',
  subtipo: 'arbol',
} as const;

const COMPLETO = arbolParaFicha({
  subId: 'LP12L10ANC23',
  idArbol: 'LP12L10ANC23-SS26',
  posicion: 23,
  especie: ANCHICO,
  parcela: { codigo: 'LP12', nombre: 'Loma-P12' },
  grupo: { codigo: 'L10', nombre: 'Línea 10' },
  createdAt: '2025-11-14T15:00:00Z',
  gps: { lat: -27.3601234, lng: -55.8974411, precision: 4.4 },
});

const COLOR_DE = coloresEnOrden('ANC', 'TIM');

test('lo que la ficha y el reporte muestran igual, formateado', () => {
  expect(datosArbol(COMPLETO)).toEqual({
    idArbol: 'LP12L10ANC23-SS26',
    parcela: { codigo: 'LP12', nombre: 'Loma-P12' },
    grupo: { codigo: 'L10', nombre: 'Línea 10' },
    posicion: '23',
    registrado: '14/11/2025',
    gps: { coordenadas: '-27.360123, -55.897441', precision: '± 4 m' },
  });
});

test('sin posición, parcela ni GPS', () => {
  expect(datosArbol({ ...COMPLETO, posicion: null, parcela: null, gps: null })).toMatchObject({
    posicion: '—',
    parcela: null,
    gps: null,
  });
});

test('GPS sin precisión muestra solo las coordenadas', () => {
  expect(gpsArbol({ lat: -27.36, lng: -55.89, precision: null })).toEqual({
    coordenadas: '-27.360000, -55.890000',
    precision: null,
  });
});

test('especie con su color, científico y clasificación', () => {
  expect(especieArbol(ANCHICO, COLOR_DE)).toEqual({
    color: COLOR_DE('ANC'),
    titulo: 'ANC · Anchico',
    cientifico: 'Parapiptadenia rigida',
    clasificacion: 'Flora · Árbol',
    sinIdentificar: false,
  });
});

test('N/N: ámbar, sin científico ni clasificación', () => {
  expect(especieArbol(null, COLOR_DE)).toEqual({
    color: COLOR_GRAFICO_NN,
    titulo: 'N/N · Sin identificar',
    cientifico: null,
    clasificacion: null,
    sinIdentificar: true,
  });
});

test('sin científico conserva la clasificación', () => {
  const especie = especieArbol({ ...ANCHICO, nombreCientifico: null }, COLOR_DE);
  expect(especie.cientifico).toBeNull();
  expect(especie.clasificacion).toBe('Flora · Árbol');
});
