import type { PuntoGps } from '../../../queries/mapaQueries';
import { arbolParaFicha } from '../../../test/fabricas';
import { COLOR_GRAFICO_NN } from '../../../theme/chartColors';
import { colorEspeciePorCodigo } from '../../../theme/coloresEspecie';
import { contenidoMinimapa } from '../minimapa';

function punto(sobre: Partial<PuntoGps>): PuntoGps {
  return {
    lat: -27.36,
    lng: -55.89,
    codigo: 'ANC',
    nombre: 'Anchico',
    idArbol: 'X-SS26',
    subId: 'X',
    parcelaId: 'parc-1',
    ...sobre,
  };
}

const ARBOL = arbolParaFicha({
  idArbol: 'A-001-SS26',
  parcelaId: 'parc-1',
  gps: { lat: -27.361, lng: -55.891, precision: 3 },
});

test('sin GPS no hay minimapa', () => {
  expect(contenidoMinimapa({ ...ARBOL, gps: null }, [punto({})])).toBeNull();
});

test('toda la parcela del árbol, sin otras parcelas ni el árbol repetido', () => {
  const puntos = [
    punto({ idArbol: 'B-SS26', codigo: 'LAP' }),
    punto({ idArbol: 'C-SS26', codigo: 'NN' }),
    punto({ idArbol: 'D-SS26', parcelaId: 'parc-2' }),
    punto({ idArbol: 'A-001-SS26', lat: -27.361, lng: -55.891 }),
  ];
  const contenido = contenidoMinimapa(ARBOL, puntos);
  expect(contenido?.puntos.map((vecino) => vecino.color)).toEqual([
    colorEspeciePorCodigo('LAP'),
    COLOR_GRAFICO_NN,
  ]);
  expect(contenido?.resaltado).toEqual({
    lat: -27.361,
    lng: -55.891,
    color: COLOR_GRAFICO_NN,
  });
});
