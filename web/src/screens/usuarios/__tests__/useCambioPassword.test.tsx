import { act, waitFor } from '@testing-library/react';
import { cambiarPassword } from '../../../services/adminUsersService';
import { eventoEnvio, renderHookConQuery } from '../../../test/renderHookConQuery';
import { useCambioPassword } from '../useCambioPassword';

vi.mock('../../../services/adminUsersService', () => ({
  cambiarPassword: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cambiarPassword).mockResolvedValue(undefined);
});

function montar() {
  const onClose = vi.fn();
  return { ...renderHookConQuery(() => useCambioPassword('user-42', onClose)), onClose };
}

type Resultado = ReturnType<typeof montar>['result'];

function escribir(result: Resultado, password: string, confirmacion: string) {
  act(() => {
    result.current.setPassword(password);
    result.current.setConfirmacion(confirmacion);
  });
}

test('una contraseña inválida muestra el motivo y no viaja al servicio', () => {
  const { result, onClose } = montar();
  escribir(result, 'password1', 'password2');

  act(() => result.current.enviar(eventoEnvio()));

  expect(result.current.error).toBe('Las contraseñas no coinciden');
  expect(cambiarPassword).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

test('una válida limpia el error anterior, llama con el id y cierra', async () => {
  const { result, onClose } = montar();
  escribir(result, '123', '123');
  act(() => result.current.enviar(eventoEnvio()));
  expect(result.current.error).toBe('La contraseña debe tener al menos 8 caracteres');

  escribir(result, 'password1', 'password1');
  const evento = eventoEnvio();
  act(() => result.current.enviar(evento));

  expect(evento.preventDefault).toHaveBeenCalled();
  expect(result.current.error).toBeNull();
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(cambiarPassword).toHaveBeenCalledWith('user-42', 'password1');
});

test('un error del servidor queda visible y no cierra', async () => {
  vi.mocked(cambiarPassword).mockRejectedValue(new Error('No se pudo completar la operación.'));
  const { result, onClose } = montar();
  escribir(result, 'password1', 'password1');

  act(() => result.current.enviar(eventoEnvio()));

  await waitFor(() => expect(result.current.error).toBe('No se pudo completar la operación.'));
  expect(onClose).not.toHaveBeenCalled();
});
