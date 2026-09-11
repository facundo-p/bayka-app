import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { listarPlantaciones, type PlantacionConStats } from '../../../queries/plantationQueries';
import { buscar, type ResultadoBusqueda } from '../../../queries/buscarQueries';
import { CommandMenuProvider } from '../../../hooks/useCommandMenu';
import { esAccion } from '../construirItems';
import { useSeccionesCommandMenu, type ContenidoPaleta } from '../useSeccionesCommandMenu';

vi.mock('../../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../../test/supabaseMock');
  return { supabase: supabaseMock };
});
vi.mock('../../../queries/plantationQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../queries/plantationQueries')>()),
  listarPlantaciones: vi.fn(),
}));
vi.mock('../../../queries/buscarQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../queries/buscarQueries')>()),
  buscar: vi.fn(),
}));

const listarPlantacionesMock = vi.mocked(listarPlantaciones);
const buscarMock = vi.mocked(buscar);

const CLAVE_RECIENTES = 'bayka.command-menu.recientes';

const PARCELA_LOMA: ResultadoBusqueda = {
  tipo: 'parcela',
  id: 'pa1',
  titulo: 'LP12 · Loma-P12',
  meta: 'San Sebastián',
  to: '/plantaciones/p1',
};

function plantacion(id: string, lugar: string, arboles: number): PlantacionConStats {
  return {
    id,
    lugar,
    arboles,
    periodo: '2025-2026',
    estado: 'activa',
    createdAt: '2025-03-12T12:00:00Z',
  } as unknown as PlantacionConStats;
}

function renderSecciones(busqueda: string, ruta = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <CommandMenuProvider>{children}</CommandMenuProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return renderHook(() => useSeccionesCommandMenu(busqueda), { wrapper });
}

function titulos(contenido: ContenidoPaleta): string[] {
  return contenido.itemsPlanos.map((item) =>
    esAccion(item) ? item.accion.titulo : item.resultado.titulo,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  listarPlantacionesMock.mockReset();
  listarPlantacionesMock.mockResolvedValue([
    plantacion('p2', 'La Carolina', 5),
    plantacion('p1', 'San Sebastián', 50),
  ]);
  buscarMock.mockReset();
  buscarMock.mockResolvedValue([]);
});

test('sin texto ni recientes: sugiere plantaciones bajo el encabezado "Sugerencias"', async () => {
  const { result } = renderSecciones('');

  await waitFor(() => expect(titulos(result.current)).toEqual(['San Sebastián', 'La Carolina']));
  expect(result.current.encabezadoVacio).toBe('Sugerencias');
  expect(result.current.secciones.map((seccion) => seccion.clave)).toEqual(['recientes']);
});

test('sin texto y con recientes guardados: muestra los recientes, no las sugerencias', async () => {
  window.localStorage.setItem(CLAVE_RECIENTES, JSON.stringify([PARCELA_LOMA]));
  const { result } = renderSecciones('');

  await waitFor(() => expect(listarPlantacionesMock).toHaveBeenCalled());
  expect(titulos(result.current)).toEqual(['LP12 · Loma-P12']);
  expect(result.current.encabezadoVacio).toBe('Recientes');
});

test('solo espacios cuenta como búsqueda vacía', async () => {
  const { result } = renderSecciones('   ');

  await waitFor(() => expect(result.current.itemsPlanos).toHaveLength(2));
  expect(result.current.encabezadoVacio).toBe('Sugerencias');
});

test('con texto: acciones que coinciden y resultados remotos agrupados, sin encabezado vacío', async () => {
  buscarMock.mockResolvedValue([PARCELA_LOMA]);
  const { result } = renderSecciones('especies');

  await waitFor(() =>
    expect(result.current.secciones.map((seccion) => seccion.clave)).toEqual([
      'acciones',
      'parcela',
    ]),
  );
  expect(titulos(result.current)).toEqual(['Ir a Especies', 'LP12 · Loma-P12']);
  expect(result.current.encabezadoVacio).toBeNull();
  expect(buscarMock).toHaveBeenLastCalledWith('especies', undefined);
});

test('dentro de una plantación: suma "Ir a Configuración…" y acota la búsqueda a esa plantación', async () => {
  const { result } = renderSecciones('configuracion', '/plantaciones/p1');

  expect(titulos(result.current)).toEqual(['Ir a Configuración…']);
  await waitFor(() =>
    expect(buscarMock).toHaveBeenLastCalledWith(
      'configuracion',
      expect.objectContaining({ plantationId: 'p1' }),
    ),
  );
});
