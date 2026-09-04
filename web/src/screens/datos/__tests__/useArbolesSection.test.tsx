import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArbolesSection } from '../useArbolesSection';
import {
  listarArboles,
  listarGrupos,
  listarParcelasConStats,
  type PaginaArboles,
} from '../../../queries/dataExplorerQueries';
import { listarCatalogo } from '../../../queries/especieQueries';
import { listarPerfiles } from '../../../queries/usuarioQueries';

vi.mock('../../../queries/dataExplorerQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/dataExplorerQueries')>(
    '../../../queries/dataExplorerQueries',
  );
  return { ...real, listarArboles: vi.fn(), listarParcelasConStats: vi.fn(), listarGrupos: vi.fn() };
});
vi.mock('../../../queries/especieQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/especieQueries')>(
    '../../../queries/especieQueries',
  );
  return { ...real, listarCatalogo: vi.fn() };
});
vi.mock('../../../queries/usuarioQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/usuarioQueries')>(
    '../../../queries/usuarioQueries',
  );
  return { ...real, listarPerfiles: vi.fn() };
});

const PARCELA = { id: 'parc-1', nombre: 'Norte', codigo: 'P1', descripcion: null, createdAt: '', grupos: 1, arboles: 1 };
const PERFIL = { id: 'user-1', nombre: 'Ana', rol: 'admin' as const, activo: true };
const PAGINA_VACIA: PaginaArboles = { arboles: [], total: 0, totalPaginas: 1 };

function renderConRuta() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/plantaciones/plant-1/datos/arboles']}>
        <Routes>
          <Route path="/plantaciones/:id/datos/arboles" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return renderHook(() => useArbolesSection(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarParcelasConStats).mockResolvedValue([PARCELA]);
  vi.mocked(listarGrupos).mockResolvedValue([]);
  vi.mocked(listarCatalogo).mockResolvedValue([]);
  vi.mocked(listarPerfiles).mockResolvedValue([PERFIL]);
  vi.mocked(listarArboles).mockResolvedValue({
    ...PAGINA_VACIA,
    total: 3,
    arboles: [],
  });
});

test('arma el recuento y los mapas de código de parcela / nombre de usuario', async () => {
  const { result } = renderConRuta();

  await waitFor(() => expect(result.current.recuento).toBe('3 árboles'));
  expect(result.current.codigosParcela.get('parc-1')).toBe('P1');
  expect(result.current.nombresUsuario.get('user-1')).toBe('Ana');
});

test('cambiar un filtro vuelve la página a 1', async () => {
  const { result } = renderConRuta();
  await waitFor(() => expect(result.current.arboles.isPending).toBe(false));

  act(() => result.current.setPagina(2));
  expect(result.current.pagina).toBe(2);

  act(() => result.current.setFiltro('speciesId', 'sp-1'));
  await waitFor(() => expect(result.current.pagina).toBe(1));
});
