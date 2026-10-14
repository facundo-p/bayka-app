import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { GrupoConDetalle, ParcelaConStats } from '../../../queries/dataExplorerQueries';
import { ANCHO, simularAncho } from '../../../test/simularAncho';
import { GruposSection } from '../GruposSection';

const PARCELA: ParcelaConStats = {
  id: 'p1',
  nombre: 'Norte',
  codigo: 'N',
  descripcion: null,
  createdAt: '2026-01-01',
  grupos: 1,
  arboles: 3,
};

const GRUPO: GrupoConDetalle = {
  id: 'g1',
  nombre: 'Línea 1',
  codigo: 'L1',
  tipo: 'linea',
  estado: 'activa',
  parcelaId: 'p1',
  parcelaCodigo: 'N',
  createdAt: '2026-01-01',
  arboles: 3,
};

vi.mock('../useDatosQueries', () => ({
  useParcelasDatos: () => ({ data: [PARCELA], isError: false }),
  useGruposDatos: () => ({ data: [GRUPO], isError: false }),
}));

function UrlActual() {
  return <output data-testid="url">{useLocation().search}</output>;
}

function renderEn(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <GruposSection />
      <UrlActual />
    </MemoryRouter>,
  );
}

test('"Limpiar filtros" del vacío por búsqueda conserva la parcela en scope', () => {
  renderEn('/datos/grupos?parcela=p1&q=zzz');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByTestId('url')).toHaveTextContent('?parcela=p1');
});

test('la parcela elegida cuenta en la toolbar y su "Limpiar" borra todos los filtros', () => {
  simularAncho(ANCHO.movil);
  renderEn('/datos/grupos?parcela=p1');
  const botonFiltros = screen.getByRole('button', { name: /Filtros/ });
  expect(botonFiltros).toHaveTextContent('Filtros1');
  fireEvent.click(botonFiltros);
  const limpiar = within(screen.getByRole('dialog')).getByRole('button', { name: 'Limpiar' });
  expect(limpiar).toBeEnabled();
  fireEvent.click(limpiar);
  expect(screen.getByTestId('url')).toBeEmptyDOMElement();
});
