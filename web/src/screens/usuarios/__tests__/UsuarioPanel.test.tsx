import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import { ROL } from '../../../repositories/profileRepository';
import { MOTIVO_ROL_PROPIO } from '../acciones';
import { ADVERTENCIA_SUPERADMIN } from '../presentacion';
import { UsuarioPanel } from '../UsuarioPanel';

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

vi.mock('../../../queries/usuarioQueries', async () => {
  const actual = await vi.importActual<typeof import('../../../queries/usuarioQueries')>(
    '../../../queries/usuarioQueries',
  );
  return { ...actual, listarPlantacionesDeUsuario: vi.fn() };
});

import { actualizarNombre, cambiarRol } from '../../../repositories/profileRepository';
import { cambiarEmail } from '../../../services/adminUsersService';
import { listarPlantacionesDeUsuario } from '../../../queries/usuarioQueries';

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
  vi.mocked(listarPlantacionesDeUsuario).mockResolvedValue([]);
});

function renderPanel({
  usuarioObjetivo = usuario(),
  idActual = 'otro-user',
  superadminsActivos = 2,
}: {
  usuarioObjetivo?: UsuarioConAsignaciones;
  idActual?: string | undefined;
  superadminsActivos?: number;
} = {}) {
  const onCerrar = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <UsuarioPanel
          usuario={usuarioObjetivo}
          idActual={idActual}
          superadminsActivos={superadminsActivos}
          onAccion={vi.fn()}
          onCerrar={onCerrar}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return onCerrar;
}

test('precarga nombre y email del usuario', () => {
  renderPanel({ usuarioObjetivo: usuario({ nombre: 'Ana', email: 'ana@bayka.org' }) });
  expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');
  expect(screen.getByLabelText('Email')).toHaveValue('ana@bayka.org');
});

test('el botón guardar arranca deshabilitado sin cambios', () => {
  renderPanel();
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
});

test('cambiar solo el nombre habilita el botón y solo llama a actualizarNombre', async () => {
  const usuarioEvento = userEvent.setup();
  const onCerrar = renderPanel({ usuarioObjetivo: usuario({ id: 'user-9', nombre: 'Equis' }) });

  const campoNombre = screen.getByLabelText('Nombre');
  await usuarioEvento.clear(campoNombre);
  await usuarioEvento.type(campoNombre, 'Nombre Nuevo');
  expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();

  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(actualizarNombre)).toHaveBeenCalledWith('user-9', 'Nombre Nuevo');
  expect(vi.mocked(cambiarEmail)).not.toHaveBeenCalled();
  expect(vi.mocked(cambiarRol)).not.toHaveBeenCalled();
});

test('email inválido: mantiene el botón deshabilitado aunque haya cambiado', async () => {
  const usuarioEvento = userEvent.setup();
  renderPanel();

  const campoEmail = screen.getByLabelText('Email');
  await usuarioEvento.clear(campoEmail);
  await usuarioEvento.type(campoEmail, 'no-es-un-email');

  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
});

test('deshabilita el campo Rol con el motivo cuando el guard aplica (cambiarse a sí mismo)', () => {
  renderPanel({
    usuarioObjetivo: usuario({ id: 'user-9' }),
    idActual: 'user-9',
  });

  const campoRol = screen.getByLabelText('Rol');
  expect(campoRol).toBeDisabled();
  expect(campoRol).toHaveAttribute('title', MOTIVO_ROL_PROPIO);
});

test('muestra la advertencia al promover a otro usuario a superadmin', async () => {
  const usuarioEvento = userEvent.setup();
  renderPanel({ usuarioObjetivo: usuario({ rol: 'tecnico' }) });

  await usuarioEvento.selectOptions(screen.getByLabelText('Rol'), ROL.SUPERADMIN);

  expect(await screen.findByRole('status')).toHaveTextContent(ADVERTENCIA_SUPERADMIN);
});

test('cambiar nombre, email y rol a la vez llama a los tres en paralelo con los valores nuevos', async () => {
  const usuarioEvento = userEvent.setup();
  const onCerrar = renderPanel({
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

  await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  expect(vi.mocked(actualizarNombre)).toHaveBeenCalledWith('user-9', 'Nombre Nuevo');
  expect(vi.mocked(cambiarEmail)).toHaveBeenCalledWith('user-9', 'nuevo@bayka.org');
  expect(vi.mocked(cambiarRol)).toHaveBeenCalledWith('user-9', ROL.ADMIN);
});

test('muestra el error del servidor y no cierra el panel', async () => {
  vi.mocked(actualizarNombre).mockRejectedValue(
    new Error('No se pudo guardar el nombre. Revisá tu conexión y probá de nuevo.'),
  );
  const usuarioEvento = userEvent.setup();
  const onCerrar = renderPanel();

  const campoNombre = screen.getByLabelText('Nombre');
  await usuarioEvento.clear(campoNombre);
  await usuarioEvento.type(campoNombre, 'Nombre Nuevo');
  await usuarioEvento.click(screen.getByRole('button', { name: 'Guardar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo guardar el nombre. Revisá tu conexión y probá de nuevo.',
  );
  expect(onCerrar).not.toHaveBeenCalled();
});

test('los roles de gestión acceden a todas las plantaciones sin consultar asignaciones', () => {
  renderPanel({ usuarioObjetivo: usuario({ rol: ROL.ADMIN }) });

  expect(screen.getByText('Acceso a todas las plantaciones')).toBeInTheDocument();
  expect(vi.mocked(listarPlantacionesDeUsuario)).not.toHaveBeenCalled();
});

test('un técnico ve sus plantaciones asignadas con link y rol', async () => {
  vi.mocked(listarPlantacionesDeUsuario).mockResolvedValue([
    { id: 'pl-1', nombre: 'Estancia La Escondida', rolEnPlantacion: ROL.TECNICO },
  ]);
  renderPanel({ usuarioObjetivo: usuario({ rol: ROL.TECNICO }) });

  expect(await screen.findByText('Estancia La Escondida')).toHaveAttribute(
    'href',
    '/plantaciones/pl-1',
  );
});

test('las acciones rápidas respetan su guard: sin email no se puede reenviar', () => {
  renderPanel({ usuarioObjetivo: usuario({ email: null }) });

  const reenviar = screen.getByRole('button', { name: 'Reenviar invitación' });
  expect(reenviar).toBeDisabled();
  expect(reenviar).toHaveAttribute('title', 'El usuario no tiene email registrado');
});
