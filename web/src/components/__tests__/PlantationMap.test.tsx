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
  return { lat: -27.1, lng: -55.2, codigo, nombre, parcelaId: 'parc-1' };
}

test('la leyenda usa los nombres de la plantación, no los de los puntos visibles', () => {
  // Filtrado por parcela solo quedan quebrachos: el algarrobo igual se nombra.
  render(<PlantationMap puntos={[punto('QB', 'Quebracho')]} leyenda={LEYENDA} />);

  expect(screen.getByText('Quebracho')).toBeInTheDocument();
  expect(screen.getByText('Algarrobo')).toBeInTheDocument();
  expect(screen.queryByText('AL')).not.toBeInTheDocument();
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

test('el chip cuenta los puntos que recibe (ya filtrados)', () => {
  render(
    <PlantationMap
      puntos={[punto('QB', 'Quebracho'), punto('QB', 'Quebracho')]}
      leyenda={LEYENDA}
      parcelaFiltro="P1"
    />,
  );

  expect(screen.getByText('2')).toBeInTheDocument();
});
