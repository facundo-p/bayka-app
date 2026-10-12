import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArbolesSection } from '../ArbolesSection';
import {
  listarArboles,
  listarGrupos,
  listarParcelasConStats,
  type ArbolDetalle,
} from '../../../queries/dataExplorerQueries';
import { listarCatalogo, listarEspeciesDePlantacion } from '../../../queries/especieQueries';
import { listarPerfiles } from '../../../queries/usuarioQueries';
import { obtenerPlantacion } from '../../../queries/plantationQueries';
import { arbolDetalle, especieEnLugar as especie, plantacion } from '../../../test/fabricas';
import { abrirFiltros } from '../../../test/panelFiltros';
import { ANCHO, simularAncho } from '../../../test/simularAncho';
import { colorEspeciePorCodigo } from '../../../theme/coloresEspecie';

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
  return { ...real, listarCatalogo: vi.fn(), listarEspeciesDePlantacion: vi.fn() };
});
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
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ estado: 'autenticado', perfil: null }),
}));
vi.mock('../../../services/pdfFichas', () => ({ descargarFichaPdf: vi.fn() }));
// El panel tiene sus propias queries (foto, mapa): acá solo importa si se abre.
vi.mock('../ArbolDetallePanel', () => ({
  ArbolDetallePanel: ({ arbol }: { arbol: ArbolDetalle }) => (
    <aside aria-label="Detalle del árbol">{arbol.idArbol}</aside>
  ),
}));

const PLANTACION = plantacion({ id: 'plant-1' });

function arbolDe(numero: number): ArbolDetalle {
  const subId = `A${numero}`;
  return arbolDetalle({ id: `arbol-${numero}`, subId, idArbol: `${subId}-SS26` });
}

const PAGINA_1 = [1, 2, 3, 4].map(arbolDe);
const PAGINA_2 = [5, 6].map(arbolDe);

function renderSeccion() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/plantaciones/plant-1/datos/arboles']}>
        <Routes>
          <Route path="/plantaciones/:id/datos/arboles" element={<ArbolesSection />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const BUSCADOR = 'Buscar por SubID o ID Árbol';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarParcelasConStats).mockResolvedValue([]);
  vi.mocked(listarGrupos).mockResolvedValue([]);
  vi.mocked(listarCatalogo).mockResolvedValue([]);
  vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([]);
  vi.mocked(listarPerfiles).mockResolvedValue([]);
  vi.mocked(obtenerPlantacion).mockResolvedValue(PLANTACION);
  vi.mocked(listarArboles).mockImplementation(async (_id, _filtros, pagina) => {
    const arboles = pagina === 1 ? PAGINA_1 : PAGINA_2;
    return { arboles, total: PAGINA_1.length + PAGINA_2.length, totalPaginas: 2 };
  });
});

test('el pie dice qué hace la fila sin decir dónde se abre', async () => {
  renderSeccion();
  expect(
    await screen.findByText('Mostrando 1–6 de 6 · clic en una fila abre el detalle'),
  ).toBeInTheDocument();
});

describe.each([ANCHO.desktop, ANCHO.movil])('la búsqueda, a %ipx', (ancho) => {
  const botonFiltros = () => screen.getByRole('button', { name: /^Filtros/ });

  test('queda a la vista, no suma en «Filtros» y «Limpiar» no la borra', async () => {
    simularAncho(ancho);
    const usuario = renderSeccion();
    await screen.findByText('A1-SS26');
    await usuario.type(screen.getByLabelText(BUSCADOR), 'A1');
    expect(botonFiltros()).toHaveTextContent(/^Filtros$/);

    const filtros = await abrirFiltros(usuario);
    expect(filtros.queryByLabelText(BUSCADOR)).not.toBeInTheDocument();
    await usuario.selectOptions(filtros.getByRole('combobox', { name: 'GPS' }), 'Con GPS');
    expect(botonFiltros()).toHaveTextContent(/^Filtros1$/);
    await usuario.click(filtros.getByRole('button', { name: 'Limpiar' }));
    expect(botonFiltros()).toHaveTextContent(/^Filtros$/);
    expect(screen.getByLabelText(BUSCADOR)).toHaveValue('A1');
  });
});

describe('colores de especie (#777, #845)', () => {
  const conEspecie = (numero: number, codigo: string) => ({
    ...arbolDe(numero),
    especieCodigo: codigo,
    especieNombre: codigo,
  });

  /** Color del punto de la fila del árbol. */
  function colorDeFila(idArbol: string): string {
    const fila = screen.getByText(idArbol).closest('tr') as HTMLElement;
    const punto = fila.querySelector('[style*="--color"]') as HTMLElement;
    return punto.style.getPropertyValue('--color');
  }

  test('cada fila pinta su especie con el color de su lugar en la plantación', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([
      especie('TIM', 1),
      especie('LAP', 2),
      especie('ANC', 0),
    ]);
    const arboles = [conEspecie(1, 'ANC'), conEspecie(2, 'TIM')];
    vi.mocked(listarArboles).mockResolvedValue({ arboles, total: 2, totalPaginas: 1 });
    renderSeccion();
    await screen.findByText('A1-SS26');
    expect(colorDeFila('A1-SS26')).toBe('#0a3760');
    expect(colorDeFila('A2-SS26')).toBe('#99b95b');
  });

  test('si las especies no se leen, una especie tiene el mismo color en todas las páginas', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('rls'));
    // Ordenando los códigos de cada página, TIM sería el segundo en la 1 y el primero en la 2.
    vi.mocked(listarArboles).mockImplementation(async (_id, _filtros, pagina) => ({
      arboles: pagina === 1 ? [conEspecie(1, 'ANC'), conEspecie(2, 'TIM')] : [conEspecie(3, 'TIM')],
      total: 3,
      totalPaginas: 2,
    }));
    const usuario = userEvent.setup();
    renderSeccion();
    await screen.findByText('A2-SS26');
    expect(colorDeFila('A2-SS26')).toBe(colorEspeciePorCodigo('TIM'));
    expect(colorDeFila('A1-SS26')).toBe(colorEspeciePorCodigo('ANC'));

    await usuario.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await screen.findByText('A3-SS26');
    expect(colorDeFila('A3-SS26')).toBe(colorEspeciePorCodigo('TIM'));
  });
});
