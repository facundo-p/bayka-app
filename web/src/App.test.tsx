import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

test('muestra el wordmark BAYKA y los links de navegación', () => {
  renderAt('/');
  expect(screen.getByText('BAYKA')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Plantaciones' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
});

test('la ruta raíz redirige al placeholder de Plantaciones', () => {
  renderAt('/');
  expect(screen.getByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
  expect(screen.getByText('Sección en construcción.')).toBeInTheDocument();
});

test('/usuarios muestra el placeholder de Usuarios', () => {
  renderAt('/usuarios');
  expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
});
