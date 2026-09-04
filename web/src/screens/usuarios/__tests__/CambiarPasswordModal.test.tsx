import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import { cambiarPassword } from '../../../services/adminUsersService';
import { CambiarPasswordModal } from '../CambiarPasswordModal';

vi.mock('../../../services/adminUsersService', () => ({
  cambiarPassword: vi.fn(),
}));

function usuario(sobreescritura: Partial<UsuarioConAsignaciones> = {}): UsuarioConAsignaciones {
  return {
    id: 'user-x',
    nombre: 'Equis',
    rol: 'tecnico',
    email: 'x@bayka.org',
    activo: true,
    organizacionId: 'org-1',
    organizacionNombre: 'Bayka',
    plantacionesAsignadas: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...sobreescritura,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cambiarPassword).mockResolvedValue(undefined);
});

function renderModal(usuarioObjetivo: UsuarioConAsignaciones = usuario()) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CambiarPasswordModal usuario={usuarioObjetivo} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

test('renderiza los campos de contraseña nueva y repetición', () => {
  renderModal();
  expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument();
  expect(screen.getByLabelText('Repetir contraseña')).toBeInTheDocument();
});

test('contraseña corta: muestra el mensaje del backend y no llama al servicio', async () => {
  const usuarioEvento = userEvent.setup();
  renderModal();

  await usuarioEvento.type(screen.getByLabelText('Contraseña nueva'), '123');
  await usuarioEvento.type(screen.getByLabelText('Repetir contraseña'), '123');
  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'La contraseña debe tener al menos 8 caracteres',
  );
  expect(vi.mocked(cambiarPassword)).not.toHaveBeenCalled();
});

test('contraseñas que no coinciden: muestra el mensaje y no llama al servicio', async () => {
  const usuarioEvento = userEvent.setup();
  renderModal();

  await usuarioEvento.type(screen.getByLabelText('Contraseña nueva'), 'password1');
  await usuarioEvento.type(screen.getByLabelText('Repetir contraseña'), 'password2');
  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
  expect(vi.mocked(cambiarPassword)).not.toHaveBeenCalled();
});

test('con contraseñas válidas llama a cambiarPassword con el id del usuario y cierra', async () => {
  const usuarioEvento = userEvent.setup();
  const onClose = renderModal(usuario({ id: 'user-42' }));

  await usuarioEvento.type(screen.getByLabelText('Contraseña nueva'), 'password1');
  await usuarioEvento.type(screen.getByLabelText('Repetir contraseña'), 'password1');
  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(cambiarPassword)).toHaveBeenCalledWith('user-42', 'password1');
});

test('muestra el error del servidor y no cierra el modal', async () => {
  vi.mocked(cambiarPassword).mockRejectedValue(new Error('No se pudo completar la operación. Probá de nuevo.'));
  const usuarioEvento = userEvent.setup();
  const onClose = renderModal();

  await usuarioEvento.type(screen.getByLabelText('Contraseña nueva'), 'password1');
  await usuarioEvento.type(screen.getByLabelText('Repetir contraseña'), 'password1');
  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo completar la operación. Probá de nuevo.',
  );
  expect(onClose).not.toHaveBeenCalled();
});
