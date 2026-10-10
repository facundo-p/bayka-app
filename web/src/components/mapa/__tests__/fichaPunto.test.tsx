import { render, screen } from '@testing-library/react';
import { COLOR_GRAFICO_NN } from '../../../theme/chartColors';
import { fichaDePunto, SIN_PARCELA } from '../fichaPunto';
import { PopupArbol } from '../PopupArbol';
import type { PuntoGps } from '../types';

const PUNTO: PuntoGps = {
  lat: -27.1,
  lng: -55.2,
  codigo: 'QB',
  nombre: 'Quebracho',
  idArbol: 'LP1L23BANC12-SS26',
  subId: 'LP1L23BANC12',
  parcelaId: 'parc-1',
};

const PARCELAS = new Map([['parc-1', { id: 'parc-1', codigo: 'P1', nombre: 'Norte' }]]);
const COLORES = new Map([['QB', '#123456']]);

describe('fichaDePunto', () => {
  test('arma ID Árbol, especie con su color y parcela', () => {
    expect(fichaDePunto(PUNTO, PARCELAS, COLORES)).toEqual({
      idArbol: 'LP1L23BANC12-SS26',
      especie: { codigo: 'QB', nombre: 'Quebracho', color: '#123456' },
      parcela: 'P1 · Norte',
    });
  });

  test('sin parcela, o con una que no está cargada, lo avisa', () => {
    expect(fichaDePunto({ ...PUNTO, parcelaId: null }, PARCELAS, COLORES).parcela).toBe(
      SIN_PARCELA,
    );
    expect(fichaDePunto({ ...PUNTO, parcelaId: 'otra' }, PARCELAS, COLORES).parcela).toBe(
      SIN_PARCELA,
    );
  });

  test('una especie sin color en la leyenda toma el de N/N, como su punto', () => {
    expect(fichaDePunto({ ...PUNTO, codigo: 'NN' }, PARCELAS, COLORES).especie.color).toBe(
      COLOR_GRAFICO_NN,
    );
  });
});

test('el popup muestra el ID Árbol, la especie y la parcela', () => {
  render(<PopupArbol ficha={fichaDePunto(PUNTO, PARCELAS, COLORES)} />);

  expect(screen.getByText('LP1L23BANC12-SS26')).toBeInTheDocument();
  expect(screen.getByText('QB').parentElement).toHaveTextContent('QB· Quebracho');
  expect(screen.getByText('P1 · Norte')).toBeInTheDocument();
});
