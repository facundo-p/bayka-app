import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PanelBloque, PanelIdentidad, PanelListaEnlaces } from '../PanelLateral';

test('PanelIdentidad pone el título como encabezado y la meta debajo', () => {
  render(<PanelIdentidad marca={<span />} titulo="Ana Pérez" meta="Técnico · desde 3/2/2025" />);

  expect(screen.getByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument();
  expect(screen.getByText('Técnico · desde 3/2/2025')).toBeInTheDocument();
});

test('PanelBloque muestra el contador aunque sea 0, y nada si no viene', () => {
  const { rerender } = render(
    <PanelBloque titulo="Plantaciones asignadas" contador={0}>
      <p>Sin plantaciones asignadas</p>
    </PanelBloque>,
  );
  expect(screen.getByText('0')).toBeInTheDocument();

  rerender(
    <PanelBloque titulo="Plantaciones asignadas">
      <p>Acceso a todas las plantaciones</p>
    </PanelBloque>,
  );
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  expect(screen.getByText('Plantaciones asignadas')).toBeInTheDocument();
});

test('PanelListaEnlaces enlaza cada fila y deja su dato a la derecha', () => {
  render(
    <MemoryRouter>
      <PanelListaEnlaces
        detalleNumerico
        enlaces={[
          { clave: 'p1', ruta: '/plantaciones/p1', texto: 'San Sebastián', detalle: '1.204' },
        ]}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: 'San Sebastián' })).toHaveAttribute(
    'href',
    '/plantaciones/p1',
  );
  expect(screen.getByText('1.204')).toBeInTheDocument();
});
