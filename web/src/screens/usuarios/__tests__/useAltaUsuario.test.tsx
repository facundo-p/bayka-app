import { act, waitFor } from '@testing-library/react';
import { crearUsuario } from '../../../services/adminUsersService';
import { espiarInvalidaciones } from '../../../test/espiarInvalidaciones';
import { eventoCambio, eventoEnvio, renderHookConQuery } from '../../../test/renderHookConQuery';
import { useAltaUsuario } from '../useAltaUsuario';

vi.mock('../../../services/adminUsersService', () => ({
  crearUsuario: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crearUsuario).mockResolvedValue(undefined);
});

function montar() {
  const onClose = vi.fn();
  return { ...renderHookConQuery(() => useAltaUsuario(onClose)), onClose };
}

test('arranca vacía, como técnico y sin poder enviar', () => {
  const { result } = montar();
  expect(result.current.valores).toEqual({ nombre: '', email: '', rol: 'tecnico' });
  expect(result.current.valido).toBe(false);
});

test('invita con los valores recortados, refresca el listado y cierra', async () => {
  const invalidaciones = espiarInvalidaciones();
  const { result, onClose } = montar();

  act(() => {
    result.current.alEscribir('nombre')(eventoCambio(' Ana '));
    result.current.alEscribir('email')(eventoCambio(' ana@bayka.org '));
    result.current.cambiar('rol', 'admin');
  });
  expect(result.current.valido).toBe(true);
  act(() => result.current.enviar(eventoEnvio()));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(crearUsuario).toHaveBeenCalledWith({
    nombre: 'Ana',
    email: 'ana@bayka.org',
    rol: 'admin',
  });
  expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['usuarios'] });
  expect(invalidaciones).toHaveBeenCalledWith({ queryKey: ['perfiles'] });
});

test('un error del alta queda visible y no cierra', async () => {
  vi.mocked(crearUsuario).mockRejectedValue(new Error('Ya existe un usuario con ese email.'));
  const { result, onClose } = montar();

  act(() => result.current.enviar(eventoEnvio()));

  await waitFor(() =>
    expect(result.current.errorEnvio).toBe('Ya existe un usuario con ese email.'),
  );
  expect(onClose).not.toHaveBeenCalled();
});
