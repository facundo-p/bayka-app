import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { espiarInvalidaciones } from '../../../test/espiarInvalidaciones';
import { ConfirmarModal } from '../ConfirmarModal';

function renderModal(overrides: Partial<React.ComponentProps<typeof ConfirmarModal>> = {}) {
  const onClose = vi.fn();
  const accion = vi.fn().mockResolvedValue(undefined);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConfirmarModal
        titulo="Desactivar usuario"
        descripcion="Esta acción se puede revertir más tarde."
        confirmarEtiqueta="Desactivar"
        accion={accion}
        onClose={onClose}
        {...overrides}
      />
    </QueryClientProvider>,
  );
  return { onClose, accion };
}

test('renderiza título, descripción y botón de confirmación', () => {
  renderModal();
  expect(screen.getByText('Esta acción se puede revertir más tarde.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
});

test('sin textoExito: confirmar ejecuta la acción y cierra', async () => {
  const usuario = userEvent.setup();
  const { onClose, accion } = renderModal();

  await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(accion).toHaveBeenCalledTimes(1);
});

test('confirmar invalida la lista de usuarios y los perfiles', async () => {
  const invalidaciones = espiarInvalidaciones();
  const usuario = userEvent.setup();
  const { onClose } = renderModal();

  await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(invalidaciones).toHaveBeenCalledTimes(2);
  expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['usuarios'] });
  expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['perfiles'] });
});

test('con textoExito: confirmar muestra el estado completado en vez de cerrar', async () => {
  const usuario = userEvent.setup();
  const { onClose, accion } = renderModal({ textoExito: 'Invitación reenviada.' });

  await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));

  expect(await screen.findByRole('status')).toHaveTextContent('Invitación reenviada.');
  expect(accion).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();

  await usuario.click(screen.getByRole('button', { name: 'Listo' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('si la acción falla muestra el error, no cierra ni invalida', async () => {
  const invalidaciones = espiarInvalidaciones();
  const usuario = userEvent.setup();
  const { onClose } = renderModal({
    accion: vi.fn().mockRejectedValue(new Error('No se pudo desactivar al usuario.')),
  });

  await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo desactivar al usuario.');
  expect(onClose).not.toHaveBeenCalled();
  expect(invalidaciones).not.toHaveBeenCalled();
});
