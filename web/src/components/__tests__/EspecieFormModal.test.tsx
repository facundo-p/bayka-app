import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CodigoEspecieDuplicadoError,
  crearEspecie,
  editarEspecie,
} from '../../repositories/especieRepository';
import type { EspecieEditable } from '../../queries/especieQueries';
import { EspecieFormModal } from '../EspecieFormModal';

vi.mock('../../repositories/especieRepository', async () => {
  const actual = await vi.importActual<typeof import('../../repositories/especieRepository')>(
    '../../repositories/especieRepository',
  );
  return {
    ...actual,
    crearEspecie: vi.fn(),
    editarEspecie: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crearEspecie).mockResolvedValue('sp-nuevo');
  vi.mocked(editarEspecie).mockResolvedValue(undefined);
});

function renderModal(especie: EspecieEditable | null = null) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <EspecieFormModal especie={especie} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

test('crear feliz: valida, llama a crearEspecie (científico null) y cierra', async () => {
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(crearEspecie)).toHaveBeenCalledWith({
    codigo: 'ANC',
    nombre: 'Anchico',
    nombreCientifico: null,
  });
});

test('campos obligatorios vacíos muestran errores y no guarda', async () => {
  const usuario = userEvent.setup();
  renderModal();

  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByText('El código es obligatorio')).toBeInTheDocument();
  expect(screen.getByText('El nombre común es obligatorio')).toBeInTheDocument();
  expect(vi.mocked(crearEspecie)).not.toHaveBeenCalled();
});

test('código duplicado: muestra aviso claro y no cierra', async () => {
  vi.mocked(crearEspecie).mockRejectedValue(new CodigoEspecieDuplicadoError());
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByText('Ya existe una especie con ese código.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test('editar: precarga los valores y llama a editarEspecie con el id', async () => {
  const usuario = userEvent.setup();
  const onClose = renderModal({
    id: 'sp-1',
    codigo: 'IBI',
    nombre: 'Ibirá Pitá',
    nombreCientifico: 'Peltophorum dubium',
  });

  expect(screen.getByLabelText('Código *')).toHaveValue('IBI');
  expect(screen.getByLabelText('Nombre común *')).toHaveValue('Ibirá Pitá');
  expect(screen.getByLabelText('Nombre científico')).toHaveValue('Peltophorum dubium');

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(editarEspecie)).toHaveBeenCalledWith('sp-1', {
    codigo: 'IBI',
    nombre: 'Ibirá Pitá',
    nombreCientifico: 'Peltophorum dubium',
  });
});

test('error de red: muestra mensaje claro y conserva lo tipeado', async () => {
  vi.mocked(crearEspecie).mockRejectedValue(new Error('network'));
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await usuario.type(screen.getByLabelText('Código *'), 'ANC');
  await usuario.type(screen.getByLabelText('Nombre común *'), 'Anchico');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo guardar la especie. Revisá tu conexión y probá de nuevo.',
  );
  expect(screen.getByLabelText('Código *')).toHaveValue('ANC');
  expect(onClose).not.toHaveBeenCalled();
});
