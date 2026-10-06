import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  crearEspecieCientifica,
  editarEspecieCientifica,
  eliminarEspecieCientifica,
  EspecieCientificaEnUsoError,
  NombreCientificoDuplicadoError,
} from '../../../repositories/especieCientificaRepository';
import type { EspecieCientificaConEspecies } from '../../../queries/especieCientificaQueries';
import { espiarInvalidaciones } from '../../../test/espiarInvalidaciones';
import { EspecieCientificaPanel } from '../EspecieCientificaPanel';

vi.mock('../../../repositories/especieCientificaRepository', async () => {
  const actual = await vi.importActual<
    typeof import('../../../repositories/especieCientificaRepository')
  >('../../../repositories/especieCientificaRepository');
  return {
    ...actual,
    crearEspecieCientifica: vi.fn(),
    editarEspecieCientifica: vi.fn(),
    eliminarEspecieCientifica: vi.fn(),
  };
});

const PROSOPIS: EspecieCientificaConEspecies = {
  id: 'ec-1',
  nombre: 'Prosopis alba',
  especies: [
    { id: 'sp-1', codigo: 'ALB', nombre: 'Algarrobo blanco' },
    { id: 'sp-2', codigo: 'IGA', nombre: 'Igarobá' },
  ],
};

const TALA: EspecieCientificaConEspecies = { id: 'ec-2', nombre: 'Celtis tala', especies: [] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crearEspecieCientifica).mockResolvedValue('ec-nueva');
  vi.mocked(editarEspecieCientifica).mockResolvedValue(undefined);
  vi.mocked(eliminarEspecieCientifica).mockResolvedValue(undefined);
});

function renderPanel(cientifica: EspecieCientificaConEspecies | null = null) {
  const onCerrar = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <EspecieCientificaPanel cientifica={cientifica} onCerrar={onCerrar} />
    </QueryClientProvider>,
  );
  return onCerrar;
}

test('crear: manda el nombre sin espacios de los bordes, invalida las especies y cierra', async () => {
  const invalidaciones = espiarInvalidaciones();
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Nombre científico *'), '  Schinus molle ');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(crearEspecieCientifica)).toHaveBeenCalledWith('Schinus molle');
  expect(invalidaciones.mock.calls.map(([filtros]) => filtros?.queryKey)).toContainEqual([
    'especies-cientificas',
  ]);
});

test('sin nombre muestra el error y no guarda', async () => {
  const usuario = userEvent.setup();
  renderPanel();

  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByText('El nombre científico es obligatorio')).toBeInTheDocument();
  expect(vi.mocked(crearEspecieCientifica)).not.toHaveBeenCalled();
});

test('un nombre repetido muestra el aviso y no cierra', async () => {
  vi.mocked(crearEspecieCientifica).mockRejectedValue(new NombreCientificoDuplicadoError());
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.type(screen.getByLabelText('Nombre científico *'), 'prosopis ALBA');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(
    await screen.findByText('Ya existe una especie científica con ese nombre.'),
  ).toBeInTheDocument();
  expect(onCerrar).not.toHaveBeenCalled();
});

test('editar: precarga el nombre, lista las especies que agrupa y guarda con el id', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel(PROSOPIS);

  const campo = screen.getByLabelText('Nombre científico *');
  expect(campo).toHaveValue('Prosopis alba');
  expect(screen.getByText('Algarrobo blanco')).toBeInTheDocument();
  expect(screen.getByText('Igarobá')).toBeInTheDocument();

  await usuario.clear(campo);
  await usuario.type(campo, 'Prosopis alba var. panta');
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(editarEspecieCientifica)).toHaveBeenCalledWith(
    'ec-1',
    'Prosopis alba var. panta',
  );
});

test('una que agrupa especies no se puede eliminar, y dice por qué', () => {
  renderPanel(PROSOPIS);

  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  expect(screen.getByText('Para eliminarla, primero desvinculá sus especies.')).toBeInTheDocument();
});

test('eliminar una sin especies pide confirmación, la borra y cierra el panel', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel(TALA);

  expect(screen.getByText(/Todavía no agrupa ninguna especie/)).toBeInTheDocument();
  await usuario.click(screen.getByRole('button', { name: 'Eliminar' }));
  const modal = await screen.findByRole('dialog', { name: 'Eliminar Celtis tala' });
  await usuario.click(within(modal).getByRole('button', { name: 'Eliminar' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(eliminarEspecieCientifica)).toHaveBeenCalledWith('ec-2');
});

test('si al confirmar ya agrupa especies, el modal muestra el error y no cierra el panel', async () => {
  vi.mocked(eliminarEspecieCientifica).mockRejectedValue(new EspecieCientificaEnUsoError());
  const usuario = userEvent.setup();
  const onCerrar = renderPanel(TALA);

  await usuario.click(screen.getByRole('button', { name: 'Eliminar' }));
  const modal = await screen.findByRole('dialog', { name: 'Eliminar Celtis tala' });
  await usuario.click(within(modal).getByRole('button', { name: 'Eliminar' }));

  expect(await within(modal).findByText(/desvinculalas antes de eliminarla/)).toBeInTheDocument();
  expect(onCerrar).not.toHaveBeenCalled();
});
