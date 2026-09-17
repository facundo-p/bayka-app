import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarUsuarios } from '../../hooks/useInvalidarUsuarios';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { guardarCambiosUsuario, type CambiosUsuario } from '../../services/edicionUsuario';
import { useValoresUsuario } from './useValoresUsuario';
import { cambiosDeEdicion, edicionValida, valoresDeUsuario } from './valores';

function useGuardadoUsuario(userId: string, onCerrar: () => void) {
  const invalidarUsuarios = useInvalidarUsuarios();
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const mutacion = useMutation({
    mutationFn: (cambios: CambiosUsuario) => guardarCambiosUsuario(userId, cambios),
    // Siempre invalidar: si una parte se guardó y otra falló (p. ej. nombre bien
    // y email duplicado), la lista igual refleja lo que sí se guardó.
    onSettled: () => invalidarUsuarios(),
    onSuccess: onCerrar,
    onError: (error: Error) => setErrorEnvio(error.message),
  });
  return { guardar: mutacion.mutate, guardando: mutacion.isPending, errorEnvio };
}

/** El formulario del panel de una persona: solo envía lo que cambió. */
export function useEdicionUsuario(
  usuario: UsuarioConAsignaciones,
  rolEditable: boolean,
  onCerrar: () => void,
) {
  const campos = useValoresUsuario(() => valoresDeUsuario(usuario));
  const cambios = cambiosDeEdicion(usuario, campos.valores, rolEditable);
  const { guardar, ...guardado } = useGuardadoUsuario(usuario.id, onCerrar);
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    guardar(cambios);
  }
  return { ...campos, ...guardado, valido: edicionValida(campos.valores, cambios), enviar };
}

export type EdicionUsuario = ReturnType<typeof useEdicionUsuario>;
