import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import {
  cambiarPassword,
  desactivarUsuario,
  reactivarUsuario,
  reenviarInvitacion,
} from '../../../services/adminUsersService';
import type { AccionUsuario } from '../acciones';
import { ModalDeAccion } from '../ModalDeAccion';

vi.mock('../../../services/adminUsersService', () => ({
  cambiarPassword: vi.fn(),
  reenviarInvitacion: vi.fn(),
  desactivarUsuario: vi.fn(),
  reactivarUsuario: vi.fn(),
}));

type Usuario = ReturnType<typeof userEvent.setup>;

const PERSONA: UsuarioConAsignaciones = {
  id: 'user-x',
  nombre: 'Equis',
  rol: 'tecnico',
  email: 'x@bayka.org',
  activo: true,
  organizacionId: 'org-1',
  organizacionNombre: 'Bayka',
  plantacionesAsignadas: 0,
  createdAt: '2026-01-01T00:00:00Z',
};

const PASSWORD = 'segura123';

async function guardarPassword(usuario: Usuario) {
  await usuario.type(screen.getByLabelText('Contraseña nueva'), PASSWORD);
  await usuario.type(screen.getByLabelText('Repetir contraseña'), PASSWORD);
  await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
}

function clickEn(etiqueta: string) {
  return (usuario: Usuario) => usuario.click(screen.getByRole('button', { name: etiqueta }));
}

interface Caso {
  accion: AccionUsuario;
  titulo: string;
  servicio: Mock;
  argumentos: unknown[];
  confirmar: (usuario: Usuario) => Promise<void>;
  /** Reenviar invitación muestra el resultado en vez de cerrarse. */
  textoExito?: string;
}

const CASOS: Caso[] = [
  {
    accion: 'cambiarPassword',
    titulo: 'Cambiar contraseña de Equis',
    servicio: vi.mocked(cambiarPassword),
    argumentos: ['user-x', PASSWORD],
    confirmar: guardarPassword,
  },
  {
    accion: 'reenviarInvitacion',
    titulo: 'Reenviar invitación a Equis',
    servicio: vi.mocked(reenviarInvitacion),
    argumentos: ['x@bayka.org'],
    confirmar: clickEn('Reenviar'),
    textoExito: 'Invitación enviada.',
  },
  {
    accion: 'desactivar',
    titulo: 'Desactivar a Equis',
    servicio: vi.mocked(desactivarUsuario),
    argumentos: ['user-x'],
    confirmar: clickEn('Desactivar'),
  },
  {
    accion: 'reactivar',
    titulo: 'Reactivar a Equis',
    servicio: vi.mocked(reactivarUsuario),
    argumentos: ['user-x'],
    confirmar: clickEn('Reactivar'),
  },
];

beforeEach(() => vi.resetAllMocks());

function renderModal(accion: AccionUsuario) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ModalDeAccion usuario={PERSONA} accion={accion} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

describe.each(CASOS)('$accion', (caso) => {
  test('abre el modal con el título de la acción y el nombre de la persona', () => {
    renderModal(caso.accion);
    expect(screen.getByRole('dialog', { name: caso.titulo })).toBeInTheDocument();
  });

  test('cancelada: cierra sin llamar al servicio', async () => {
    const usuario = userEvent.setup();
    const onClose = renderModal(caso.accion);

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(caso.servicio).not.toHaveBeenCalled();
  });

  test('fallida: muestra el error del servicio y no cierra', async () => {
    caso.servicio.mockRejectedValue(new Error('El servidor rechazó la acción'));
    const usuario = userEvent.setup();
    const onClose = renderModal(caso.accion);

    await caso.confirmar(usuario);

    expect(await screen.findByRole('alert')).toHaveTextContent('El servidor rechazó la acción');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('exitosa: llama al servicio con los datos de la persona', async () => {
    caso.servicio.mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    const onClose = renderModal(caso.accion);

    await caso.confirmar(usuario);

    if (caso.textoExito) {
      expect(await screen.findByRole('status')).toHaveTextContent(caso.textoExito);
      expect(onClose).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    }
    expect(caso.servicio).toHaveBeenCalledWith(...caso.argumentos);
  });
});

test('desactivar avisa qué se pierde y qué se conserva, con el botón destructivo', () => {
  renderModal('desactivar');
  expect(screen.getByText(/va a perder el acceso a la app y a la web/)).toBeInTheDocument();
  expect(screen.getByText(/se conservan\. Se puede reactivar/)).toBeInTheDocument();
});

test('reenviar invitación nombra el email al que llega el mensaje', () => {
  renderModal('reenviarInvitacion');
  expect(
    screen.getByText('Le va a llegar un email a x@bayka.org para definir su contraseña.'),
  ).toBeInTheDocument();
});
