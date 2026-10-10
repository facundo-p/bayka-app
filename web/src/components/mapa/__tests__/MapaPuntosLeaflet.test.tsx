import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { clavesDePuntos } from '../clavesDePuntos';
import { MapaPuntosLeaflet } from '../MapaPuntosLeaflet';
import type { PuntoGps } from '../types';

interface MarkerFalsoProps {
  center: [number, number];
  pathOptions?: { fillColor?: string };
}

// jsdom no tiene canvas ni layout: cada marker se vuelve un span con lo que
// Leaflet recibiría, y así se ve qué color le llega a cada punto.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Popup: () => null,
  // Sin zoom calculable, AjustarVista no encuadra ni consulta a Esri.
  useMap: () => ({ invalidateSize: vi.fn(), getBoundsZoom: () => NaN }),
  CircleMarker: ({ center, pathOptions }: MarkerFalsoProps) => (
    <span data-testid="marker" data-lat={center[0]} data-color={pathOptions?.fillColor} />
  ),
}));

const COLORES = new Map([
  ['ANC', '#0a3760'],
  ['IBI', '#99b95b'],
]);

function punto(idArbol: string, codigo: string, lat: number): PuntoGps {
  return { lat, lng: 0, codigo, nombre: '', idArbol, subId: idArbol, parcelaId: null };
}

const PUNTOS = [punto('A1', 'ANC', 1), punto('A2', 'ANC', 2), punto('I1', 'IBI', 3)];

function coloresPorLatitud(): Record<string, string | undefined> {
  return Object.fromEntries(
    screen.getAllByTestId('marker').map((marker) => [marker.dataset.lat, marker.dataset.color]),
  );
}

test('al filtrar, cada punto conserva el color de su especie', () => {
  const { rerender } = render(<MapaPuntosLeaflet puntos={PUNTOS} colorPorCodigo={COLORES} />);
  expect(coloresPorLatitud()).toEqual({ 1: '#0a3760', 2: '#0a3760', 3: '#99b95b' });

  rerender(<MapaPuntosLeaflet puntos={[PUNTOS[2]]} colorPorCodigo={COLORES} />);

  expect(coloresPorLatitud()).toEqual({ 3: '#99b95b' });
});

describe('clavesDePuntos', () => {
  test('usa el ID Árbol y desambigua los repetidos', () => {
    const repetidos = [punto('A1', 'ANC', 1), punto('B1', 'ANC', 2), punto('A1', 'ANC', 3)];

    expect(clavesDePuntos(repetidos)).toEqual(['A1', 'B1', 'A1#1']);
  });
});
