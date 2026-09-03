import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { crearUsuario } from '../../../services/adminUsersService';
import { ROL } from '../../../repositories/profileRepository';
import { AgregarUsuarioModal } from '../AgregarUsuarioModal';

vi.mock('../../../services/adminUsersService', () => ({
  crearUsuario: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crearUsuario).mockResolvedValue(undefined);
});

function renderModal() {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AgregarUsuarioModal onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

test('renderiza los campos nombre, email y rol', () => {
  renderModal();
  expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  expect(screen.getByLabelText('Rol')).toBeInTheDocument();
});

test('el botón de enviar arranca deshabilitado y se habilita con nombre y email válidos', async () => {
  const usuario = userEvent.setup();
  renderModal();

  const boton = screen.getByRole('button', { name: 'Enviar invitación' });
  expect(boton).toBeDisabled();

  await usuario.type(screen.getByLabelText('Nombre'), 'Ana');
  expect(boton).toBeDisabled();

  await usuario.type(screen.getByLabelText('Email'), 'no-es-un-email');
  expect(boton).toBeDisabled();

  await usuario.clear(screen.getByLabelText('Email'));
  await usuario.type(screen.getByLabelText('Email'), 'ana@bayka.org');
  expect(boton).not.toBeDisabled();
});

test('no muestra la advertencia de superadmin por defecto (rol técnico)', () => {
  renderModal();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('muestra la advertencia al elegir el rol superadmin', async () => {
  const usuario = userEvent.setup();
  renderModal();

  await usuario.selectOptions(screen.getByLabelText('Rol'), ROL.SUPERADMIN);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Va a tener acceso total, incluida la gestión de usuarios.',
  );
});

test('al enviar llama a crearUsuario con los datos recortados y cierra', async () => {
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await usuario.type(screen.getByLabelText('Nombre'), '  Ana  ');
  await usuario.type(screen.getByLabelText('Email'), '  ana@bayka.org  ');
  await usuario.selectOptions(screen.getByLabelText('Rol'), ROL.ADMIN);
  await usuario.click(screen.getByRole('button', { name: 'Enviar invitación' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(crearUsuario)).toHaveBeenCalledWith({
    nombre: 'Ana',
    email: 'ana@bayka.org',
    rol: ROL.ADMIN,
  });
});

test('muestra el error del servidor y no cierra el modal', async () => {
  vi.mocked(crearUsuario).mockRejectedValue(new Error('Ya existe un usuario con ese email'));
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await usuario.type(screen.getByLabelText('Nombre'), 'Ana');
  await usuario.type(screen.getByLabelText('Email'), 'ana@bayka.org');
  await usuario.click(screen.getByRole('button', { name: 'Enviar invitación' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ya existe un usuario con ese email',
  );
  expect(onClose).not.toHaveBeenCalled();
});
