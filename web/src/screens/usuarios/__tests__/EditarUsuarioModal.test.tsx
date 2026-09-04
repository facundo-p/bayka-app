import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import { ROL } from '../../../repositories/profileRepository';
import { MOTIVO_ROL_PROPIO } from '../acciones';
import { ADVERTENCIA_SUPERADMIN } from '../presentacion';
import { EditarUsuarioModal } from '../EditarUsuarioModal';

vi.mock('../../../repositories/profileRepository', async () => {
  const actual = await vi.importActual<typeof import('../../../repositories/profileRepository')>(
    '../../../repositories/profileRepository',
  );
  return {
    ...actual,
    actualizarNombre: vi.fn(),
    cambiarRol: vi.fn(),
  };
});

vi.mock('../../../services/adminUsersService', () => ({
  cambiarEmail: vi.fn(),
}));

import { actualizarNombre, cambiarRol } from '../../../repositories/profileRepository';
import { cambiarEmail } from '../../../services/adminUsersService';

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
  vi.mocked(actualizarNombre).mockResolvedValue(undefined);
  vi.mocked(cambiarRol).mockResolvedValue(undefined);
  vi.mocked(cambiarEmail).mockResolvedValue(undefined);
});

function renderModal({
  usuarioObjetivo = usuario(),
  idActual = 'otro-user',
  superadminsActivos = 2,
}: {
  usuarioObjetivo?: UsuarioConAsignaciones;
  idActual?: string | undefined;
  superadminsActivos?: number;
} = {}) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <EditarUsuarioModal
        usuario={usuarioObjetivo}
        idActual={idActual}
        superadminsActivos={superadminsActivos}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return onClose;
}

test('precarga nombre y email del usuario', () => {
  renderModal({ usuarioObjetivo: usuario({ nombre: 'Ana', email: 'ana@bayka.org' }) });
  expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');
  expect(screen.getByLabelText('Email')).toHaveValue('ana@bayka.org');
});

test('el botón guardar arranca deshabilitado sin cambios', () => {
  renderModal();
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
});

test('cambiar solo el nombre habilita el botón y solo llama a actualizarNombre', async () => {
  const usuarioEvento = userEvent.setup();
  const onClose = renderModal({ usuarioObjetivo: usuario({ id: 'user-9', nombre: 'Equis' }) });

  const campoNombre = screen.getByLabelText('Nombre');
  await usuarioEvento.clear(campoNombre);
  await usuarioEvento.type(campoNombre, 'Nombre Nuevo');
  expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();

  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(actualizarNombre)).toHaveBeenCalledWith('user-9', 'Nombre Nuevo');
  expect(vi.mocked(cambiarEmail)).not.toHaveBeenCalled();
  expect(vi.mocked(cambiarRol)).not.toHaveBeenCalled();
});

test('email inválido: mantiene el botón deshabilitado aunque haya cambiado', async () => {
  const usuarioEvento = userEvent.setup();
  renderModal();

  const campoEmail = screen.getByLabelText('Email');
  await usuarioEvento.clear(campoEmail);
  await usuarioEvento.type(campoEmail, 'no-es-un-email');

  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
});

test('deshabilita el campo Rol con el motivo cuando el guard aplica (cambiarse a sí mismo)', () => {
  renderModal({
    usuarioObjetivo: usuario({ id: 'user-9' }),
    idActual: 'user-9',
  });

  const campoRol = screen.getByLabelText('Rol');
  expect(campoRol).toBeDisabled();
  expect(campoRol).toHaveAttribute('title', MOTIVO_ROL_PROPIO);
});

test('muestra la advertencia al promover a otro usuario a superadmin', async () => {
  const usuarioEvento = userEvent.setup();
  renderModal({ usuarioObjetivo: usuario({ rol: 'tecnico' }) });

  await usuarioEvento.selectOptions(screen.getByLabelText('Rol'), ROL.SUPERADMIN);

  expect(await screen.findByRole('status')).toHaveTextContent(ADVERTENCIA_SUPERADMIN);
});

test('cambiar nombre, email y rol a la vez llama a los tres en paralelo con los valores nuevos', async () => {
  const usuarioEvento = userEvent.setup();
  const onClose = renderModal({
    usuarioObjetivo: usuario({ id: 'user-9', nombre: 'Equis', email: 'x@bayka.org', rol: 'tecnico' }),
  });

  const campoNombre = screen.getByLabelText('Nombre');
  await usuarioEvento.clear(campoNombre);
  await usuarioEvento.type(campoNombre, 'Nombre Nuevo');

  const campoEmail = screen.getByLabelText('Email');
  await usuarioEvento.clear(campoEmail);
  await usuarioEvento.type(campoEmail, 'nuevo@bayka.org');

  await usuarioEvento.selectOptions(screen.getByLabelText('Rol'), ROL.ADMIN);

  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(actualizarNombre)).toHaveBeenCalledWith('user-9', 'Nombre Nuevo');
  expect(vi.mocked(cambiarEmail)).toHaveBeenCalledWith('user-9', 'nuevo@bayka.org');
  expect(vi.mocked(cambiarRol)).toHaveBeenCalledWith('user-9', ROL.ADMIN);
});

test('muestra el error del servidor y no cierra el modal', async () => {
  vi.mocked(actualizarNombre).mockRejectedValue(
    new Error('No se pudo guardar el nombre. Revisá tu conexión y probá de nuevo.'),
  );
  const usuarioEvento = userEvent.setup();
  const onClose = renderModal();

  const campoNombre = screen.getByLabelText('Nombre');
  await usuarioEvento.clear(campoNombre);
  await usuarioEvento.type(campoNombre, 'Nombre Nuevo');
  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo guardar el nombre. Revisá tu conexión y probá de nuevo.',
  );
  expect(onClose).not.toHaveBeenCalled();
});
