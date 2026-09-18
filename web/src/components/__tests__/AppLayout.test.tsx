import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../hooks/useAuth';
import { prepararSesionAdmin, resetEstadoMock } from '../../test/supabaseMock';
import { AppLayout } from '../AppLayout';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

function Bomba(): never {
  throw new Error('render roto');
}

/** Rutas propias dentro del layout real: una que rompe y una sana. */
function renderLayoutEn(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/rota" element={<Bomba />} />
              <Route path="/plantaciones" element={<p>Listado sano</p>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetEstadoMock();
  prepararSesionAdmin();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('una pantalla que rompe al renderizar deja el sidebar y muestra el fallback (#338)', async () => {
  renderLayoutEn('/rota');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Algo salió mal al mostrar esta pantalla.',
  );
  expect(screen.getByRole('link', { name: 'Plantaciones' })).toBeInTheDocument();
});

test('navegar a otra pantalla desde el fallback la renderiza normal', async () => {
  const usuario = userEvent.setup();
  renderLayoutEn('/rota');
  await screen.findByRole('alert');
  await usuario.click(screen.getByRole('link', { name: 'Plantaciones' }));
  expect(await screen.findByText('Listado sano')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
