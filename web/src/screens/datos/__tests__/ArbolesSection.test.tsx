import { render, screen, waitFor, within } from '@testing-library/react';
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
import { listarCatalogo } from '../../../queries/especieQueries';
import { listarPerfiles } from '../../../queries/usuarioQueries';
import { obtenerPlantacion } from '../../../queries/plantationQueries';
import { descargarFichasPdf } from '../../../services/pdfFichas';
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
vi.mock('../../../services/pdfFichas', () => ({
  descargarFichaPdf: vi.fn(),
  descargarFichasPdf: vi.fn(),
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
const BOTON_PDF = 'Elegir árboles para las fichas PDF';
const barra = () => screen.getByRole('region', { name: 'Árboles seleccionados' });
const casilla = (numero: number) =>
  screen.getByRole('checkbox', { name: `Seleccionar el árbol A${numero}-SS26` });
const maestro = () =>
  screen.getByRole('checkbox', { name: 'Seleccionar todos los árboles de esta página' });
const generar = () =>
  within(barra()).getByRole('button', { name: /Generar fichas|Generando fichas/ });

async function entrarAlModo() {
  const usuario = renderSeccion();
  await usuario.click(await screen.findByRole('button', { name: BOTON_PDF }));
  return usuario;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarParcelasConStats).mockResolvedValue([]);
  vi.mocked(listarGrupos).mockResolvedValue([]);
  vi.mocked(listarCatalogo).mockResolvedValue([]);
  vi.mocked(listarPerfiles).mockResolvedValue([]);
  vi.mocked(obtenerPlantacion).mockResolvedValue(PLANTACION);
  vi.mocked(listarArboles).mockImplementation(async (_id, _filtros, pagina) => {
    const arboles = pagina === 1 ? PAGINA_1 : PAGINA_2;
    return { arboles, total: PAGINA_1.length + PAGINA_2.length, totalPaginas: 2 };
  });
});

describe('entrar y salir del modo selección', () => {
  test('sin modo no hay checkboxes ni franja', async () => {
    renderSeccion();
    await screen.findByText('A1-SS26');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Árboles seleccionados' })).toBeNull();
  });

  test('el botón dice «PDF» y su tooltip explica que elige árboles', async () => {
    renderSeccion();
    const boton = await screen.findByRole('button', { name: BOTON_PDF });
    expect(boton).toHaveTextContent('PDF');
    expect(boton).toHaveAttribute('title', 'Elegir árboles para las fichas PDF');
  });

  test('el botón «PDF» muestra los checkboxes y la franja, y se oculta', async () => {
    await entrarAlModo();
    expect(casilla(1)).toBeInTheDocument();
    expect(maestro()).toHaveAttribute('aria-checked', 'false');
    expect(barra()).toHaveTextContent('0 árboles seleccionados');
    expect(screen.queryByRole('button', { name: BOTON_PDF })).toBeNull();
  });

  test('«Cancelar» sale del modo y limpia la selección', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(casilla(1));
    await usuario.click(within(barra()).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: BOTON_PDF }));
    expect(casilla(1)).toHaveAttribute('aria-checked', 'false');
  });
});

describe('foco', () => {
  test('al entrar pasa a la franja y al cancelar vuelve al botón «PDF»', async () => {
    const usuario = await entrarAlModo();
    expect(barra()).toHaveFocus();
    await usuario.click(within(barra()).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: BOTON_PDF })).toHaveFocus();
  });

  test('si la sección se remonta tras un error, la franja no roba el foco', async () => {
    const usuario = await entrarAlModo();
    vi.mocked(listarArboles).mockRejectedValueOnce(new Error('caída'));
    await usuario.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await screen.findByText('A5-SS26');
    expect(barra()).not.toHaveFocus();
  });

  test('al cargar la pantalla no se lo lleva el botón «PDF»', async () => {
    renderSeccion();
    expect(await screen.findByRole('button', { name: BOTON_PDF })).not.toHaveFocus();
  });
});

describe('marcar filas', () => {
  test('el checkbox marca la fila sin abrir el detalle', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(casilla(2));
    expect(casilla(2)).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('complementary', { name: 'Detalle del árbol' })).toBeNull();
  });

  test('tocar la fila sigue abriendo el detalle', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(screen.getByText('A3-SS26'));
    expect(screen.getByRole('complementary', { name: 'Detalle del árbol' })).toHaveTextContent(
      'A3-SS26',
    );
    expect(casilla(3)).toHaveAttribute('aria-checked', 'false');
  });

  test('el maestro pasa por sus tres estados', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(casilla(1));
    expect(maestro()).toHaveAttribute('aria-checked', 'mixed');

    await usuario.click(maestro());
    expect(maestro()).toHaveAttribute('aria-checked', 'true');
    expect(barra()).toHaveTextContent('Los 4 árboles de esta página');

    await usuario.click(maestro());
    expect(maestro()).toHaveAttribute('aria-checked', 'false');
  });

  test('Espacio sobre el checkbox lo marca sin abrir el detalle', async () => {
    const usuario = await entrarAlModo();
    casilla(2).focus();
    await usuario.keyboard(' ');
    expect(casilla(2)).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('complementary', { name: 'Detalle del árbol' })).toBeNull();
  });

  test('singular y plural del recuento', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(casilla(1));
    expect(barra()).toHaveTextContent('1 árbol seleccionado');
    await usuario.click(casilla(2));
    expect(barra()).toHaveTextContent('2 árboles seleccionados');
  });
});

describe('la selección vale para la página actual', () => {
  test('cambiar de página la limpia y el modo sigue activo', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(casilla(1));
    await usuario.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await screen.findByText('A5-SS26');
    expect(barra()).toHaveTextContent('0 árboles seleccionados');

    await usuario.click(screen.getByRole('button', { name: 'Página anterior' }));
    await screen.findByText('A1-SS26');
    expect(casilla(1)).toHaveAttribute('aria-checked', 'false');
  });

  test('mientras llega la página nueva, las filas viejas no se marcan', async () => {
    const usuario = await entrarAlModo();
    vi.mocked(listarArboles).mockReturnValue(new Promise(() => {}));
    await usuario.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await usuario.click(casilla(1));
    expect(casilla(1)).toHaveAttribute('aria-checked', 'false');
    expect(barra()).toHaveTextContent('0 árboles seleccionados');
  });

  test('el botón «PDF» no se deshabilita mientras llega otra página', async () => {
    const usuario = renderSeccion();
    await screen.findByText('A1-SS26');
    vi.mocked(listarArboles).mockReturnValue(new Promise(() => {}));
    await usuario.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('button', { name: BOTON_PDF })).toBeEnabled();
  });

  test('la búsqueda, al aplicarse tras el debounce, la limpia', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(casilla(1));
    await usuario.type(screen.getByLabelText(BUSCADOR), 'A');
    expect(barra()).toHaveTextContent('1 árbol seleccionado');
    await waitFor(() => expect(barra()).toHaveTextContent('0 árboles seleccionados'));
  });

  test('cambiar un filtro la limpia', async () => {
    const usuario = await entrarAlModo();
    await usuario.click(casilla(1));
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'GPS' }), 'Con GPS');
    await waitFor(() => expect(barra()).toHaveTextContent('0 árboles seleccionados'));
    expect(casilla(1)).toHaveAttribute('aria-checked', 'false');
  });
});

describe('generar fichas', () => {
  test('con 0 marcados queda deshabilitado', async () => {
    await entrarAlModo();
    expect(generar()).toHaveTextContent('Generar fichas (0)');
    expect(generar()).toBeDisabled();
  });

  test('genera un solo PDF con los ids en el orden del listado', async () => {
    vi.mocked(descargarFichasPdf).mockResolvedValue();
    const usuario = await entrarAlModo();
    await usuario.click(casilla(4));
    await usuario.click(casilla(1));
    await usuario.click(casilla(3));
    await waitFor(() => expect(generar()).toBeEnabled());

    await usuario.click(generar());
    expect(descargarFichasPdf).toHaveBeenCalledTimes(1);
    expect(descargarFichasPdf).toHaveBeenCalledWith(
      ['arbol-1', 'arbol-3', 'arbol-4'],
      expect.objectContaining({ plantacion: PLANTACION }),
    );
  });

  test('mientras genera muestra «Generando fichas…» y no acepta otro click', async () => {
    let terminar = () => {};
    vi.mocked(descargarFichasPdf).mockReturnValue(
      new Promise<void>((resolver) => (terminar = resolver)),
    );
    const usuario = await entrarAlModo();
    await usuario.click(casilla(2));
    await waitFor(() => expect(generar()).toBeEnabled());
    await usuario.click(generar());

    expect(generar()).toHaveTextContent('Generando fichas…');
    expect(generar()).toBeDisabled();
    expect(within(barra()).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    terminar();
    await waitFor(() => expect(generar()).toHaveTextContent('Generar fichas (1)'));
  });

  test('el error se borra al cambiar la selección', async () => {
    vi.mocked(descargarFichasPdf).mockRejectedValue(new Error('boom'));
    const usuario = await entrarAlModo();
    await usuario.click(casilla(2));
    await waitFor(() => expect(generar()).toBeEnabled());
    await usuario.click(generar());
    await within(barra()).findByText('No se pudieron generar las fichas');

    await usuario.click(casilla(3));
    expect(within(barra()).queryByText('No se pudieron generar las fichas')).toBeNull();
  });

  test('si falla, muestra el error', async () => {
    vi.mocked(descargarFichasPdf).mockRejectedValue(new Error('boom'));
    const usuario = await entrarAlModo();
    await usuario.click(casilla(2));
    await waitFor(() => expect(generar()).toBeEnabled());
    await usuario.click(generar());
    expect(await within(barra()).findByText('No se pudieron generar las fichas')).toBeVisible();
  });
});
