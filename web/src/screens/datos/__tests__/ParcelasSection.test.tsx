import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { ParcelaConStats } from '../../../queries/dataExplorerQueries';
import { ANCHO, simularAncho } from '../../../test/simularAncho';
import { ParcelasSection } from '../ParcelasSection';

const PARCELA: ParcelaConStats = {
  id: 'p1',
  nombre: 'Norte',
  codigo: 'N',
  descripcion: null,
  createdAt: '2026-01-01',
  grupos: 1,
  arboles: 3,
};

vi.mock('../useDatosQueries', () => ({
  useParcelasDatos: () => ({ data: [PARCELA], isError: false }),
}));

function UrlActual() {
  return <output data-testid="url">{useLocation().search}</output>;
}

function renderEn(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ParcelasSection />
      <UrlActual />
    </MemoryRouter>,
  );
}

test.each([ANCHO.movil, ANCHO.desktop])(
  'a %ipx la búsqueda queda a la vista y Parcelas no tiene botón de filtros',
  (ancho) => {
    simularAncho(ancho);
    renderEn('/datos/parcelas?parcela=p1&q=zzz');
    expect(screen.getByRole('searchbox')).toHaveValue('zzz');
    expect(screen.queryByRole('button', { name: /Filtros/ })).not.toBeInTheDocument();
  },
);

test('"Limpiar filtros" del vacío solo vacía la búsqueda', () => {
  renderEn('/datos/parcelas?parcela=p1&q=zzz');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByTestId('url')).toHaveTextContent('?parcela=p1');
});
