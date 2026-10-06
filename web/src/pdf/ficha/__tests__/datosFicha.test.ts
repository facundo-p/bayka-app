import { arbolParaFicha } from '../../../test/fabricas';
import { COLOR_GRAFICO_NN } from '../../../theme/chartColors';
import { colorEspeciePorCodigo } from '../../../theme/coloresEspecie';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { ESTADO_MAPA, type MapaPdf } from '../../mapa/estadoMapa';
import { datosFicha, documentoDeFichas, hojasConSatelite } from '../datosFicha';

const FOTO: FotoPdf = { estado: ESTADO_FOTO.lista, src: 'data:image/jpeg;base64,AAA' };
const MAPA: MapaPdf = {
  estado: ESTADO_MAPA.listo,
  src: 'data:image/png;base64,BBB',
  conSatelite: false,
};

const COMPLETO = arbolParaFicha({
  subId: 'LP12L10ANC23',
  idArbol: 'LP12L10ANC23-SS26',
  idGlobal: 10479,
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
  createdAt: '2025-11-14T15:00:00Z',
  gps: { lat: -27.3601234, lng: -55.8974411, precision: 4.4 },
});

const CONTEXTO = { tecnico: 'Lucía Ferreyra', foto: FOTO, mapa: MAPA };

test('ficha completa: todo formateado para pintar', () => {
  expect(datosFicha(COMPLETO, CONTEXTO)).toEqual({
    subId: 'LP12L10ANC23',
    idArbol: 'LP12L10ANC23-SS26',
    idGlobal: '10479',
    especie: {
      color: colorEspeciePorCodigo('ANC'),
      titulo: 'ANC · Anchico',
      cientifico: 'Parapiptadenia rigida',
      clasificacion: 'Flora · Árbol',
      sinIdentificar: false,
    },
    parcela: { codigo: 'LP12', nombre: 'Loma-P12' },
    grupo: { codigo: 'L10', nombre: 'Línea 10' },
    posicion: '23',
    registrado: '14/11/2025',
    tecnico: 'Lucía Ferreyra',
    gps: { coordenadas: '-27.360123, -55.897441', precision: '± 4 m' },
    foto: FOTO,
    mapa: MAPA,
  });
});

test('sin foto pasa el placeholder que le toca', () => {
  const sinFoto: FotoPdf = { estado: ESTADO_FOTO.sinFoto };
  expect(datosFicha(COMPLETO, { ...CONTEXTO, foto: sinFoto }).foto).toBe(sinFoto);
});

test('sin GPS no hay coordenadas ni mapa, aunque llegue uno', () => {
  const ficha = datosFicha({ ...COMPLETO, gps: null }, CONTEXTO);
  expect(ficha.gps).toBeNull();
  expect(ficha.mapa).toEqual({ estado: 'sin-gps' });
});

test('GPS sin precisión muestra solo las coordenadas', () => {
  const gps = { lat: -27.36, lng: -55.89, precision: null };
  expect(datosFicha({ ...COMPLETO, gps }, CONTEXTO).gps).toEqual({
    coordenadas: '-27.360000, -55.890000',
    precision: null,
  });
});

test('N/N: ámbar, sin científico ni clasificación', () => {
  expect(datosFicha({ ...COMPLETO, especie: null }, CONTEXTO).especie).toEqual({
    color: COLOR_GRAFICO_NN,
    titulo: 'N/N · Sin identificar',
    cientifico: null,
    clasificacion: null,
    sinIdentificar: true,
  });
});

test('sin ID Global generado queda en null para la marca', () => {
  expect(datosFicha({ ...COMPLETO, idGlobal: null }, CONTEXTO).idGlobal).toBeNull();
});

test('sin científico conserva la clasificación', () => {
  const especie = { ...COMPLETO.especie!, nombreCientifico: null };
  const ficha = datosFicha({ ...COMPLETO, especie }, CONTEXTO);
  expect(ficha.especie.cientifico).toBeNull();
  expect(ficha.especie.clasificacion).toBe('Flora · Árbol');
});

test('sin posición, técnico ni parcela', () => {
  const ficha = datosFicha(
    { ...COMPLETO, posicion: null, parcela: null },
    { ...CONTEXTO, tecnico: null },
  );
  expect(ficha.posicion).toBe('—');
  expect(ficha.tecnico).toBe('—');
  expect(ficha.parcela).toBeNull();
});

test('el pie nombra el documento según cuántas fichas lleva', () => {
  expect(documentoDeFichas(1)).toBe('Ficha de árbol');
  expect(documentoDeFichas(12)).toBe('Fichas de árboles · 12 árboles');
});

test('hojasConSatelite: las hojas, de a tres fichas, con algún minimapa satelital', () => {
  const contexto = { tecnico: null, foto: FOTO };
  const liso = datosFicha(COMPLETO, { ...contexto, mapa: MAPA });
  const satelital = datosFicha(COMPLETO, { ...contexto, mapa: { ...MAPA, conSatelite: true } });
  const sinGps = datosFicha({ ...COMPLETO, gps: null }, { ...contexto, mapa: MAPA });
  expect(hojasConSatelite([liso, liso, liso, satelital, sinGps, liso, liso])).toEqual(new Set([2]));
  expect(hojasConSatelite([satelital, liso, liso, liso])).toEqual(new Set([1]));
  expect(hojasConSatelite([liso, sinGps])).toEqual(new Set());
});
