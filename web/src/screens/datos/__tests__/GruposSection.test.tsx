import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { GrupoConDetalle, ParcelaConStats } from '../../../queries/dataExplorerQueries';
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

test('"Limpiar filtros" del vacío por búsqueda conserva la parcela en scope', () => {
  render(
    <MemoryRouter initialEntries={['/datos/grupos?parcela=p1&q=zzz']}>
      <GruposSection />
      <UrlActual />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByTestId('url')).toHaveTextContent('?parcela=p1');
});
