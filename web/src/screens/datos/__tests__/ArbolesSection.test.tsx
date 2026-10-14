import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArbolesSection } from '../ArbolesSection';
import {
  contarArbolesDelFiltro,
  listarArboles,
  listarGrupos,
  listarParcelasConStats,
  type ArbolDetalle,
} from '../../../queries/dataExplorerQueries';
import { listarCatalogo, listarEspeciesDePlantacion } from '../../../queries/especieQueries';
import { listarPerfiles } from '../../../queries/usuarioQueries';
import { obtenerPlantacion } from '../../../queries/plantationQueries';
import { descargarReportePdf, ETAPA_REPORTE } from '../../../services/pdfReporte';
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
    contarArbolesDelFiltro: vi.fn(),
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
vi.mock('../../../services/pdfFicha', () => ({ descargarFichaPdf: vi.fn() }));
vi.mock('../../../services/pdfReporte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pdfReporte')>()),
  descargarReportePdf: vi.fn(),
}));
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

describe.each([ANCHO.desktop, ANCHO.movil])('el reporte PDF, a %ipx', (ancho) => {
  const botonReporte = () => screen.getByRole('button', { name: 'Reporte PDF' });

  test('está en la barra y cuenta con los filtros aplicados, búsqueda incluida', async () => {
    simularAncho(ancho);
    vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 2, conFoto: 0 });
    const usuario = renderSeccion();
    await screen.findByText('A1-SS26');
    await usuario.type(screen.getByLabelText(BUSCADOR), 'A1');
    await waitFor(() =>
      expect(listarArboles).toHaveBeenLastCalledWith(
        'plant-1',
        expect.objectContaining({ busqueda: 'A1' }),
        1,
      ),
    );
    await usuario.click(botonReporte());
    const modal = within(screen.getByRole('dialog', { name: 'Reporte PDF de árboles' }));
    expect(await modal.findByText('2 árboles en el filtro, 0 con foto.')).toBeInTheDocument();
    expect(contarArbolesDelFiltro).toHaveBeenCalledWith(
      'plant-1',
      expect.objectContaining({ busqueda: 'A1' }),
    );
  });

  test('sin árboles en el filtro queda deshabilitado', async () => {
    simularAncho(ancho);
    vi.mocked(listarArboles).mockResolvedValue({ arboles: [], total: 0, totalPaginas: 0 });
    renderSeccion();
    await screen.findByText('Sin árboles para mostrar');
    expect(botonReporte()).toBeDisabled();
  });
});

describe('un reporte a medio generar', () => {
  /** Abre el reporte y lo deja bajando fotos; devuelve su señal. */
  async function reporteEnCurso(usuario: ReturnType<typeof userEvent.setup>) {
    vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 6, conFoto: 2 });
    let senal: AbortSignal | undefined;
    vi.mocked(descargarReportePdf).mockImplementation((pedido) => {
      senal = pedido.senal;
      pedido.alProgresar?.({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 1, total: 2 });
      return new Promise(() => {});
    });
    await screen.findByText('A1-SS26');
    await usuario.click(screen.getByRole('button', { name: 'Reporte PDF' }));
    const modal = within(screen.getByRole('dialog', { name: 'Reporte PDF de árboles' }));
    await usuario.click(await modal.findByRole('button', { name: 'Generar PDF' }));
    expect(screen.getByText('Bajando fotos: 1 de 2')).toBeInTheDocument();
    return () => senal!;
  }

  test('sigue al cruzar el ancho de teléfono, que rearma la barra', async () => {
    const senal = await reporteEnCurso(renderSeccion());
    act(() => simularAncho(ANCHO.movil));
    expect(screen.getByRole('dialog', { name: 'Reporte PDF de árboles' })).toBeInTheDocument();
    expect(screen.getByText('Bajando fotos: 1 de 2')).toBeInTheDocument();
    expect(senal().aborted).toBe(false);
  });

  test('se corta al salir de la sección', async () => {
    const senal = await reporteEnCurso(renderSeccion());
    cleanup();
    expect(senal().aborted).toBe(true);
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
