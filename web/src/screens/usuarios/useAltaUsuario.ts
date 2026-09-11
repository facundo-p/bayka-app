import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarUsuarios } from '../../hooks/useInvalidarUsuarios';
import { crearUsuario } from '../../services/adminUsersService';
import { useValoresUsuario } from './useValoresUsuario';
import { altaValida, normalizar, VALORES_ALTA, type ValoresUsuario } from './valores';

function useInvitacion(onClose: () => void) {
  const invalidarUsuarios = useInvalidarUsuarios();
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const mutacion = useMutation({
    mutationFn: (valores: ValoresUsuario) => crearUsuario(normalizar(valores)),
    onSuccess: async () => {
      await invalidarUsuarios();
      onClose();
    },
    onError: (error: Error) => setErrorEnvio(error.message),
  });
  return { invitar: mutacion.mutate, enviando: mutacion.isPending, errorEnvio };
}

/** Los campos del alta, si se puede enviar y el envío de la invitación. */
export function useAltaUsuario(onClose: () => void) {
  const campos = useValoresUsuario(VALORES_ALTA);
  const { invitar, ...invitacion } = useInvitacion(onClose);
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    invitar(campos.valores);
  }
  return { ...campos, ...invitacion, valido: altaValida(campos.valores), enviar };
}

export type AltaUsuario = ReturnType<typeof useAltaUsuario>;
