import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { ESTADO_MAPA, type MapaPdf } from '../../mapa/estadoMapa';
import { datosFicha } from '../datosFicha';

const FOTO: FotoPdf = { estado: ESTADO_FOTO.lista, src: 'data:image/jpeg;base64,AAA' };
const MAPA: MapaPdf = {
  estado: ESTADO_MAPA.listo,
  src: 'data:image/png;base64,BBB',
  conSatelite: false,
};

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
  createdAt: '2025-11-14T15:00:00Z',
  gps: { lat: -27.3601234, lng: -55.8974411, precision: 4.4 },
});

const COLOR_DE = coloresEnOrden('ANC', 'TIM');
const CONTEXTO = { tecnico: 'Lucía Ferreyra', foto: FOTO, mapa: MAPA, colorDe: COLOR_DE };

test('ficha completa: todo formateado para pintar', () => {
  expect(datosFicha(COMPLETO, CONTEXTO)).toEqual({
    subId: 'LP12L10ANC23',
    idArbol: 'LP12L10ANC23-SS26',
    especie: {
      color: COLOR_DE('ANC'),
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

test('sin posición, técnico ni parcela', () => {
  const ficha = datosFicha(
    { ...COMPLETO, posicion: null, parcela: null },
    { ...CONTEXTO, tecnico: null },
  );
  expect(ficha.posicion).toBe('—');
  expect(ficha.tecnico).toBe('—');
  expect(ficha.parcela).toBeNull();
});
