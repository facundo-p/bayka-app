import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import { eliminarUsuario, previsualizarEliminacion } from '../../../services/adminUsersService';
import { EliminarUsuarioModal } from '../EliminarUsuarioModal';

vi.mock('../../../services/adminUsersService', () => ({
  previsualizarEliminacion: vi.fn(),
  eliminarUsuario: vi.fn(),
}));

const PERSONA: UsuarioConAsignaciones = {
  id: 'user-x',
  nombre: 'Equis',
  rol: 'tecnico',
  email: 'x@bayka.org',
  activo: true,
  eliminadoEn: null,
  organizacionId: 'org-1',
  organizacionNombre: 'Bayka',
  plantacionesAsignadas: 0,
  createdAt: '2026-01-01T00:00:00Z',
};

function renderModal() {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <EliminarUsuarioModal usuario={PERSONA} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const botonEliminar = () => screen.getByRole('button', { name: 'Eliminar' });

beforeEach(() => {
  (eliminarUsuario as Mock).mockResolvedValue(undefined);
});

test('mientras carga el preview no se puede confirmar', () => {
  (previsualizarEliminacion as Mock).mockReturnValue(new Promise(() => {}));
  renderModal();
  expect(screen.getByText('Revisando qué datos registró…')).toBeInTheDocument();
  expect(botonEliminar()).toBeDisabled();
});

test('sin datos: se borra por completo, con el aviso de lo no sincronizado', async () => {
  (previsualizarEliminacion as Mock).mockResolvedValue({
    arboles: 0,
    grupos: 0,
    plantaciones: 0,
    modo: 'real',
  });
  const usuario = userEvent.setup();
  const { onClose } = renderModal();

  expect(
    await screen.findByText('Equis no registró datos: se borra por completo.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Lo que tenga sin sincronizar en su celular se pierde. Esta acción no se puede deshacer.',
    ),
  ).toBeInTheDocument();

  await usuario.click(botonEliminar());
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(eliminarUsuario).toHaveBeenCalledWith('user-x');
});

test('con datos: detalla lo registrado, omitiendo lo que está en cero', async () => {
  (previsualizarEliminacion as Mock).mockResolvedValue({
    arboles: 1,
    grupos: 0,
    plantaciones: 2,
    modo: 'logico',
  });
  renderModal();

  expect(
    await screen.findByText(
      'Equis registró 1 árbol y 2 plantaciones: se bloquea para siempre, su nombre queda en el ' +
        'historial y su email se libera para invitarlo de nuevo.',
    ),
  ).toBeInTheDocument();
  expect(botonEliminar()).toBeEnabled();
});

test('si el preview falla muestra el error y no deja confirmar', async () => {
  (previsualizarEliminacion as Mock).mockRejectedValue(
    new Error('El usuario fue eliminado: ya no admite cambios'),
  );
  renderModal();

  expect(
    await screen.findByText('El usuario fue eliminado: ya no admite cambios'),
  ).toBeInTheDocument();
  expect(botonEliminar()).toBeDisabled();
});
