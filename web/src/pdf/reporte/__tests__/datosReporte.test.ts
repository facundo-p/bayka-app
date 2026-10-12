import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { COLOR_GRAFICO_NN } from '../../../theme/chartColors';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { datosArbolReporte, datosTarjeta, documentoDeReporte } from '../datosReporte';

const COMPLETO = arbolParaFicha({
  subId: 'LP12L10ANC23',
  idArbol: 'LP12L10ANC23-SS26',
  posicion: 23,
  especie: {
    codigo: 'ANC',
    nombre: 'Anchico',
    nombreCientifico: 'Parapiptadenia rigida',
    tipo: 'flora',
    subtipo: 'arbol',
  },
  parcela: { codigo: 'LP12', nombre: 'Loma-P12' },
  grupo: { codigo: 'L10', nombre: 'Línea 10' },
  usuarioRegistro: 'u1',
  createdAt: '2025-11-14T15:00:00Z',
  gps: { lat: -27.3601234, lng: -55.8974411, precision: 4.4 },
});

const COLOR_DE = coloresEnOrden('ANC', 'TIM');

test('fila completa: todo formateado para pintar, sin técnico ni científico', () => {
  expect(datosArbolReporte(COMPLETO, COLOR_DE)).toEqual({
    idArbol: 'LP12L10ANC23-SS26',
    especie: { color: COLOR_DE('ANC'), titulo: 'ANC · Anchico', sinIdentificar: false },
    parcela: { codigo: 'LP12', nombre: 'Loma-P12' },
    grupo: { codigo: 'L10', nombre: 'Línea 10' },
    posicion: '23',
    registrado: '14/11/2025',
    gps: { coordenadas: '-27.360123, -55.897441', precision: '± 4 m' },
  });
});

test('N/N, sin parcela, sin posición y sin GPS', () => {
  const sinNada = arbolParaFicha({ especie: null, parcela: null, posicion: null, gps: null });
  expect(datosArbolReporte(sinNada, COLOR_DE)).toMatchObject({
    especie: { color: COLOR_GRAFICO_NN, titulo: 'N/N · Sin identificar', sinIdentificar: true },
    parcela: null,
    posicion: '—',
    gps: null,
  });
});

test('la tarjeta es la fila con su foto', () => {
  const foto: FotoPdf = { estado: ESTADO_FOTO.noDisponible };
  expect(datosTarjeta(COMPLETO, foto, COLOR_DE)).toEqual({
    ...datosArbolReporte(COMPLETO, COLOR_DE),
    foto,
  });
});

test('el pie nombra el documento con la cantidad de árboles', () => {
  expect(documentoDeReporte(148)).toBe('Reporte de árboles · 148 árboles');
  expect(documentoDeReporte(1)).toBe('Reporte de árboles · 1 árbol');
  expect(documentoDeReporte(7000)).toBe('Reporte de árboles · 7.000 árboles');
});
