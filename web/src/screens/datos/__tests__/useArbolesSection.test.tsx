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
import { obtenerPlantacion } from '../../../queries/plantationQueries';
import { descargarFichaPdf } from '../../../services/pdfFichas';
import { arbolDetalle, plantacion } from '../../../test/fabricas';

vi.mock('../../../queries/dataExplorerQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/dataExplorerQueries')>(
    '../../../queries/dataExplorerQueries',
  );
  return {
    ...real,
    listarArboles: vi.fn(),
    listarParcelasConStats: vi.fn(),
    listarGrupos: vi.fn(),
  };
});
vi.mock('../../../queries/especieQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/especieQueries')>(
    '../../../queries/especieQueries',
  );
  return { ...real, listarCatalogo: vi.fn() };
});
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ estado: 'autenticado', perfil: PERFIL }),
}));
vi.mock('../../../queries/usuarioQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/usuarioQueries')>(
    '../../../queries/usuarioQueries',
  );
  return { ...real, listarPerfiles: vi.fn() };
});

vi.mock('../../../queries/plantationQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/plantationQueries')>(
    '../../../queries/plantationQueries',
  );
  return { ...real, obtenerPlantacion: vi.fn() };
});
vi.mock('../../../services/pdfFichas', () => ({ descargarFichaPdf: vi.fn() }));

const PARCELA = {
  id: 'parc-1',
  nombre: 'Norte',
  codigo: 'P1',
  descripcion: null,
  createdAt: '',
  grupos: 1,
  arboles: 1,
};
const PERFIL = {
  id: 'user-1',
  nombre: 'Ana',
  rol: 'admin' as const,
  email: 'ana@bayka.org',
  activo: true,
};
const PLANTACION = plantacion({ id: 'plant-1' });
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
  vi.mocked(obtenerPlantacion).mockResolvedValue(PLANTACION);
  vi.mocked(listarArboles).mockResolvedValue({
    ...PAGINA_VACIA,
    total: 3,
    arboles: [],
  });
});

test('arma los mapas de código de parcela y nombre de usuario', async () => {
  const { result } = renderConRuta();

  await waitFor(() => expect(result.current.arboles.isPending).toBe(false));
  expect(result.current.codigosParcela.get('parc-1')).toBe('P1');
  expect(result.current.nombresUsuario.get('user-1')).toBe('Ana');
});

test('un técnico sin nombre figura con su id corto', async () => {
  vi.mocked(listarPerfiles).mockResolvedValue([{ ...PERFIL, id: 'abcdefgh-9999', nombre: '' }]);
  const { result } = renderConRuta();

  await waitFor(() => expect(result.current.nombresUsuario.get('abcdefgh-9999')).toBe('abcdefgh'));
});

test('cambiar el filtro de foto vuelve la página a 1', async () => {
  const { result } = renderConRuta();
  await waitFor(() => expect(result.current.arboles.isPending).toBe(false));

  act(() => result.current.setPagina(2));
  act(() => result.current.setFiltro('foto', 'con'));
  await waitFor(() => expect(result.current.pagina).toBe(1));
});

test('cambiar un filtro vuelve la página a 1', async () => {
  const { result } = renderConRuta();
  await waitFor(() => expect(result.current.arboles.isPending).toBe(false));

  act(() => result.current.setPagina(2));
  expect(result.current.pagina).toBe(2);

  act(() => result.current.setFiltro('speciesId', 'sp-1'));
  await waitFor(() => expect(result.current.pagina).toBe(1));
});

describe('ficha PDF', () => {
  const ARBOL = arbolDetalle({ id: 'arbol-9' });

  test('con plantación y técnicos cargados, descarga la ficha del árbol con su contexto', async () => {
    const { result } = renderConRuta();
    await waitFor(() => expect(result.current.descargaFichaDe(ARBOL)).not.toBeNull());

    await result.current.descargaFichaDe(ARBOL)?.();
    expect(descargarFichaPdf).toHaveBeenCalledWith('arbol-9', {
      plantacion: PLANTACION,
      nombresUsuario: new Map([['user-1', 'Ana']]),
      queryClient: expect.any(QueryClient),
    });
  });

  test('mientras cargan los técnicos queda deshabilitada, para no imprimir «Técnico —»', async () => {
    vi.mocked(listarPerfiles).mockReturnValue(new Promise(() => {}));
    const { result } = renderConRuta();
    await waitFor(() => expect(result.current.plantacion).toEqual(PLANTACION));

    expect(result.current.descargaFichaDe(ARBOL)).toBeNull();
  });

  test('sin la plantación queda deshabilitada', async () => {
    vi.mocked(obtenerPlantacion).mockReturnValue(new Promise(() => {}));
    const { result } = renderConRuta();
    await waitFor(() => expect(result.current.nombresUsuario.size).toBe(1));

    expect(result.current.descargaFichaDe(ARBOL)).toBeNull();
  });
});
