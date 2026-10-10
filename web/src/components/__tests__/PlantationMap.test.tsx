import { render, screen } from '@testing-library/react';
import type { PuntoGps } from '../../queries/mapaQueries';
import { PlantationMap } from '../PlantationMap';

// Leaflet necesita APIs de layout que jsdom no implementa.
vi.mock('../mapa/MapaPuntos', () => ({
  MapaPuntos: () => <div>Mapa satelital</div>,
}));

const LEYENDA = [
  { codigo: 'QB', nombre: 'Quebracho', color: '#1a1a1a' },
  { codigo: 'AL', nombre: 'Algarrobo', color: '#2b2b2b' },
];

function punto(codigo: string, nombre: string): PuntoGps {
  return {
    lat: -27.1,
    lng: -55.2,
    codigo,
    nombre,
    idArbol: 'LP1L23BANC12-SS26-1',
    subId: 'LP1L23BANC12',
    parcelaId: 'parc-1',
  };
}

test('el header queda solo con el título: sin leyenda de especies ni chip de puntos', () => {
  render(<PlantationMap puntos={[punto('QB', 'Quebracho')]} leyenda={LEYENDA} />);

  expect(screen.getByRole('heading', { name: 'Mapa de la plantación' })).toBeInTheDocument();
  expect(screen.queryByText('Quebracho')).not.toBeInTheDocument();
  expect(screen.queryByText('Algarrobo')).not.toBeInTheDocument();
  expect(screen.queryByText(/^puntos?$/)).not.toBeInTheDocument();
});

test('sin filtro: subtítulo genérico y vacío genérico', () => {
  render(<PlantationMap puntos={[]} leyenda={LEYENDA} />);

  expect(screen.getByText(/Puntos GPS registrados/)).toBeInTheDocument();
  expect(screen.getByText('Sin puntos GPS todavía')).toBeInTheDocument();
});

test('con filtro: el subtítulo y el vacío nombran la parcela', () => {
  render(<PlantationMap puntos={[]} leyenda={LEYENDA} parcelaFiltro="P1" />);

  expect(screen.getByText(/Parcela P1/)).toBeInTheDocument();
  expect(screen.getByText('Sin puntos GPS en la parcela P1')).toBeInTheDocument();
});

test.each([
  [{ especieFiltro: 'Quebracho' }, /^Quebracho · imagen/, 'Sin puntos GPS de Quebracho'],
  [
    { parcelaFiltro: 'P1', especieFiltro: 'Quebracho' },
    /Parcela P1 · Quebracho/,
    'Sin puntos GPS de Quebracho en la parcela P1',
  ],
])('con especie: el subtítulo y el vacío la nombran (%o)', (filtros, subtitulo, vacio) => {
  render(<PlantationMap puntos={[]} leyenda={LEYENDA} {...filtros} />);

  expect(screen.getByText(subtitulo)).toBeInTheDocument();
  expect(screen.getByText(vacio)).toBeInTheDocument();
});

