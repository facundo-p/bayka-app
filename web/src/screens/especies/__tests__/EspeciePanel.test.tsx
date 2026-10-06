import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CodigoEspecieDuplicadoError,
  crearEspecie,
  editarEspecie,
} from '../../../repositories/especieRepository';
import {
  listarPlantacionesDeEspecie,
  type EspecieConCatalogoUso,
} from '../../../queries/especieQueries';
import { listarEspeciesCientificas } from '../../../queries/especieCientificaQueries';
import { espiarInvalidaciones } from '../../../test/espiarInvalidaciones';
import { EspeciePanel } from '../EspeciePanel';

vi.mock('../../../repositories/especieRepository', async () => {
  const actual = await vi.importActual<typeof import('../../../repositories/especieRepository')>(
    '../../../repositories/especieRepository',
  );
  return {
    ...actual,
    crearEspecie: vi.fn(),
    editarEspecie: vi.fn(),
  };
});

vi.mock('../../../queries/especieCientificaQueries', () => ({
  listarEspeciesCientificas: vi.fn(),
}));

vi.mock('../../../queries/especieQueries', async () => {
  const actual = await vi.importActual<typeof import('../../../queries/especieQueries')>(
    '../../../queries/especieQueries',
  );
  return { ...actual, listarPlantacionesDeEspecie: vi.fn() };
});

const IBIRA: EspecieConCatalogoUso = {
  id: 'sp-1',
  codigo: 'IBI',
  nombre: 'Ibirá Pitá',
  nombreCientifico: 'Peltophorum dubium',
  tipo: 'flora',
  subtipo: 'arbusto',
  especieCientificaId: 'ec-1',
  plantaciones: 2,
  arboles: 1402,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crearEspecie).mockResolvedValue('sp-nuevo');
  vi.mocked(editarEspecie).mockResolvedValue(undefined);
  vi.mocked(listarEspeciesCientificas).mockResolvedValue([
    {
      id: 'ec-1',
      nombre: 'Peltophorum dubium',
      especies: [
        { id: 'sp-1', codigo: 'IBI', nombre: 'Ibirá Pitá' },
        { id: 'sp-9', codigo: 'CAN', nombre: 'Caña fístola' },
      ],
    },
    { id: 'ec-2', nombre: 'Prosopis alba', especies: [] },
  ]);
  vi.mocked(listarPlantacionesDeEspecie).mockResolvedValue([
    { id: 'pl-1', nombre: 'Estancia La Escondida', arboles: 934 },
    { id: 'pl-2', nombre: 'Campo Los Molles', arboles: 468 },
  ]);
});

function renderPanel(especie: EspecieConCatalogoUso | null = null) {
  const onCerrar = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <EspeciePanel especie={especie} onCerrar={onCerrar} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return onCerrar;
}

test('crear feliz: valida, llama a crearEspecie (científico null, Flora / Árbol) y cierra', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(crearEspecie)).toHaveBeenCalledWith({
    codigo: 'ANC',
    nombre: 'Anchico',
    especieCientificaId: null,
    tipo: 'flora',
    subtipo: 'arbol',
  });
});

test('el alta muestra el tipo fijo en Flora y el subtipo preseleccionado en Árbol', () => {
  renderPanel();

  expect(screen.getByText('Flora')).toBeInTheDocument();
  const subtipo = screen.getByRole('radiogroup', { name: 'Subtipo *' });
  expect(within(subtipo).getByRole('radio', { name: 'Árbol' })).toBeChecked();
  expect(within(subtipo).getByRole('radio', { name: 'Arbusto' })).not.toBeChecked();
});

test('elegir Arbusto en el alta lo guarda como subtipo', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Código *'), 'CHI');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Chilca');
  await usuario.click(screen.getByRole('radio', { name: 'Arbusto' }));
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(crearEspecie)).toHaveBeenCalledWith(
    expect.objectContaining({ tipo: 'flora', subtipo: 'arbusto' }),
  );
});

test('campos obligatorios vacíos muestran errores y no guarda', async () => {
  const usuario = userEvent.setup();
  renderPanel();

  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByText('El código es obligatorio')).toBeInTheDocument();
  expect(screen.getByText('El nombre común es obligatorio')).toBeInTheDocument();
  expect(vi.mocked(crearEspecie)).not.toHaveBeenCalled();
});

test('código duplicado: muestra aviso claro y no cierra', async () => {
  vi.mocked(crearEspecie).mockRejectedValue(new CodigoEspecieDuplicadoError());
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByText('Ya existe una especie con ese código.')).toBeInTheDocument();
  expect(onCerrar).not.toHaveBeenCalled();
});

test('editar: precarga los valores y llama a editarEspecie con el id', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel(IBIRA);

  expect(screen.getByLabelText('Código *')).toHaveValue('IBI');
  expect(screen.getByLabelText('Nombre común *')).toHaveValue('Ibirá Pitá');
  expect(await screen.findByRole('button', { name: /Especie científica/ })).toHaveTextContent(
    'Peltophorum dubium',
  );
  expect(screen.getByRole('radio', { name: 'Arbusto' })).toBeChecked();

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(editarEspecie)).toHaveBeenCalledWith('sp-1', {
    codigo: 'IBI',
    nombre: 'Ibirá Pitá',
    especieCientificaId: 'ec-1',
    tipo: 'flora',
    subtipo: 'arbusto',
  });
});

/** Catálogo, catálogo con uso, científicas y, por familia, dashboard, mapa y tabla de Árboles. */
const CLAVES_CON_ESPECIES = [
  ['especies-catalogo'],
  ['especies-catalogo-uso'],
  ['especies-cientificas'],
  ['dashboard'],
  ['mapa'],
  ['datos-arboles'],
  ['especies-habilitadas'],
];

function clavesInvalidadas(invalidaciones: ReturnType<typeof espiarInvalidaciones>) {
  return invalidaciones.mock.calls.map(([filtros]) => filtros?.queryKey);
}

test('crear invalida toda vista que muestra especies', async () => {
  const invalidaciones = espiarInvalidaciones();
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(clavesInvalidadas(invalidaciones)).toEqual(CLAVES_CON_ESPECIES);
});

test('editar invalida toda vista que muestra especies', async () => {
  const invalidaciones = espiarInvalidaciones();
  const usuario = userEvent.setup();
  const onCerrar = renderPanel(IBIRA);

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(clavesInvalidadas(invalidaciones)).toEqual(CLAVES_CON_ESPECIES);
});

test('error de red: muestra mensaje claro y conserva lo tipeado', async () => {
  vi.mocked(crearEspecie).mockRejectedValue(new Error('TypeError: Failed to fetch'));
  const invalidaciones = espiarInvalidaciones();
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo guardar la especie. Revisá tu conexión y probá de nuevo.',
  );
  expect(screen.getByLabelText('Código *')).toHaveValue('ANC');
  expect(onCerrar).not.toHaveBeenCalled();
  expect(invalidaciones).not.toHaveBeenCalled();
});

test('editar muestra los conteos y dónde está habilitada, con link a la plantación', async () => {
  renderPanel(IBIRA);

  expect(await screen.findByText('Estancia La Escondida')).toHaveAttribute(
    'href',
    '/plantaciones/pl-1',
  );
  expect(screen.getByText('934')).toBeInTheDocument();
  // Conteos agregados de la cabecera del bloque.
  expect(screen.getByText('1.402')).toBeInTheDocument();
});

test('el alta no muestra bloques de contexto ni consulta el uso', () => {
  renderPanel();

  expect(screen.queryByText('Habilitada en')).not.toBeInTheDocument();
  expect(screen.queryByText('Plantaciones')).not.toBeInTheDocument();
  expect(vi.mocked(listarPlantacionesDeEspecie)).not.toHaveBeenCalled();
});

test('Escape cierra el panel', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel(IBIRA);

  await usuario.keyboard('{Escape}');
  expect(onCerrar).toHaveBeenCalled();
});

test('elegir una especie científica la vincula; la lista muestra las otras especies que agrupa', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Código *'), 'CAN');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Caña fístola');
  await usuario.click(await screen.findByRole('button', { name: /Especie científica/ }));
  expect(screen.getByText('Agrupa Ibirá Pitá, Caña fístola')).toBeInTheDocument();
  await usuario.click(screen.getByRole('option', { name: /Prosopis alba/ }));
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(crearEspecie)).toHaveBeenCalledWith(
    expect.objectContaining({ especieCientificaId: 'ec-2' }),
  );
});

test('elegir «Sin especie científica» desvincula al guardar', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel(IBIRA);

  await usuario.click(await screen.findByRole('button', { name: /Especie científica/ }));
  await usuario.click(screen.getByRole('option', { name: 'Sin especie científica' }));
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(editarEspecie)).toHaveBeenCalledWith(
    'sp-1',
    expect.objectContaining({ especieCientificaId: null }),
  );
});
