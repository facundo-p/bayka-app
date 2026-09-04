import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { generarIds, seedSugerido } from '../../../queries/idsQueries';
import { GenerarIdsModal } from '../GenerarIdsModal';

vi.mock('../../../queries/idsQueries', () => ({
  generarIds: vi.fn(),
  seedSugerido: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(seedSugerido).mockResolvedValue(42);
  vi.mocked(generarIds).mockResolvedValue({ updated: 10, seed: 42 });
});

function renderModal() {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenerarIdsModal plantationId="plant-1" onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

test('precarga el seed sugerido una vez que resuelve la query', async () => {
  renderModal();
  expect(await screen.findByDisplayValue('42')).toBeInTheDocument();
});

test('editar el input actualiza el valor mostrado', async () => {
  const usuario = userEvent.setup();
  renderModal();

  const input = await screen.findByDisplayValue('42');
  await usuario.clear(input);
  await usuario.type(input, '100');

  expect(screen.getByLabelText('ID global inicial')).toHaveValue(100);
});

test('seed inválido (0) muestra el error y no llama a generarIds', async () => {
  const usuario = userEvent.setup();
  renderModal();

  const input = await screen.findByDisplayValue('42');
  await usuario.clear(input);
  await usuario.type(input, '0');
  await usuario.click(screen.getByRole('button', { name: 'Generar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ingresá un número entero mayor a 0.',
  );
  expect(vi.mocked(generarIds)).not.toHaveBeenCalled();
});

test('seed inválido (vacío) muestra el error y no llama a generarIds', async () => {
  const usuario = userEvent.setup();
  renderModal();

  const input = await screen.findByDisplayValue('42');
  await usuario.clear(input);
  await usuario.click(screen.getByRole('button', { name: 'Generar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ingresá un número entero mayor a 0.',
  );
  expect(vi.mocked(generarIds)).not.toHaveBeenCalled();
});

test('seed inválido (negativo) muestra el error y no llama a generarIds', async () => {
  const usuario = userEvent.setup();
  renderModal();

  const input = await screen.findByDisplayValue('42');
  await usuario.clear(input);
  await usuario.type(input, '-5');
  await usuario.click(screen.getByRole('button', { name: 'Generar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ingresá un número entero mayor a 0.',
  );
  expect(vi.mocked(generarIds)).not.toHaveBeenCalled();
});

test('seed válido llama a generarIds con la plantación y el seed elegido', async () => {
  const usuario = userEvent.setup();
  renderModal();

  const input = await screen.findByDisplayValue('42');
  await usuario.clear(input);
  await usuario.type(input, '100');
  await usuario.click(screen.getByRole('button', { name: 'Generar' }));

  await waitFor(() => expect(vi.mocked(generarIds)).toHaveBeenCalledTimes(1));
  expect(vi.mocked(generarIds)).toHaveBeenCalledWith('plant-1', 100);
});

test('al confirmar con éxito, cierra el modal', async () => {
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await screen.findByDisplayValue('42');
  await usuario.click(screen.getByRole('button', { name: 'Generar' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('mientras genera, el botón "Generar" queda en loading (deshabilitado)', async () => {
  let resolverGeneracion: (valor: { updated: number; seed: number }) => void = () => {};
  vi.mocked(generarIds).mockReturnValue(
    new Promise((resolve) => {
      resolverGeneracion = resolve;
    }),
  );
  const usuario = userEvent.setup();
  renderModal();

  await screen.findByDisplayValue('42');
  await usuario.click(screen.getByRole('button', { name: 'Generar' }));

  const boton = screen.getByRole('button', { name: /Generar/ });
  expect(boton).toBeDisabled();
  expect(screen.getByRole('status')).toBeInTheDocument();

  resolverGeneracion({ updated: 1, seed: 42 });
});
