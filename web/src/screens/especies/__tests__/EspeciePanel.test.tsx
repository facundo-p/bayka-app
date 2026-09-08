import { render, screen, waitFor } from '@testing-library/react';
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
  plantaciones: 2,
  arboles: 1402,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crearEspecie).mockResolvedValue('sp-nuevo');
  vi.mocked(editarEspecie).mockResolvedValue(undefined);
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

test('crear feliz: valida, llama a crearEspecie (científico null) y cierra', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(crearEspecie)).toHaveBeenCalledWith({
    codigo: 'ANC',
    nombre: 'Anchico',
    nombreCientifico: null,
  });
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
  expect(screen.getByLabelText('Nombre científico')).toHaveValue('Peltophorum dubium');

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(editarEspecie)).toHaveBeenCalledWith('sp-1', {
    codigo: 'IBI',
    nombre: 'Ibirá Pitá',
    nombreCientifico: 'Peltophorum dubium',
  });
});

test('error de red: muestra mensaje claro y conserva lo tipeado', async () => {
  vi.mocked(crearEspecie).mockRejectedValue(new Error('network'));
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
