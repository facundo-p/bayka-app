import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../hooks/useAuth';
import { AppRoutes } from '../App';

/** Renderiza las rutas reales con los providers de test.
 *  Query client propio por render: sin retry y sin cache compartida. */
export function renderRutasEn(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** El contenido de la pantalla vive en <main>: acotar ahí evita chocar con el
 *  sidebar, que repite textos como el lugar de la temporada activa. */
export function enMain() {
  return within(screen.getByRole('main'));
}

/** `enMain` para recién renderizado: la ruta monta cuando resuelve la sesión. */
export async function esperarMain() {
  return within(await screen.findByRole('main'));
}
