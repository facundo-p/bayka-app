import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { validarNuevaPassword } from '../../lib/validarPassword';
import { cambiarPassword } from '../../services/adminUsersService';

/** Valida antes de llamar a la edge function: una contraseña inválida no viaja. */
function useEnvioPassword(userId: string, onClose: () => void) {
  const [error, setError] = useState<string | null>(null);
  const mutacion = useMutation({
    mutationFn: (password: string) => cambiarPassword(userId, password),
    onSuccess: onClose,
    onError: (errorEnvio: Error) => setError(errorEnvio.message),
  });
  function intentar(password: string, confirmacion: string) {
    const invalidez = validarNuevaPassword(password, confirmacion);
    setError(invalidez);
    if (invalidez === null) mutacion.mutate(password);
  }
  return { intentar, error, guardando: mutacion.isPending };
}

/** La contraseña nueva, su repetición y el envío. */
export function useCambioPassword(userId: string, onClose: () => void) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const { intentar, ...envio } = useEnvioPassword(userId, onClose);
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    intentar(password, confirmacion);
  }
  return { password, setPassword, confirmacion, setConfirmacion, ...envio, enviar };
}

export type CambioPassword = ReturnType<typeof useCambioPassword>;
