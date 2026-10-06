import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidarEspecies } from '../../hooks/useInvalidarEspecies';
import { mensajeDeError } from '../../lib/clasificarError';
import type { EspecieCientificaConEspecies } from '../../queries/especieCientificaQueries';
import {
  crearEspecieCientifica,
  editarEspecieCientifica,
  NombreCientificoDuplicadoError,
} from '../../repositories/especieCientificaRepository';
import { validarNombreCientifico } from '../../services/especieValidaciones';

const ACCION_GUARDAR = 'guardar la especie científica';

/** Alta o edición del nombre de una especie científica, con sus errores. */
export function useFormularioCientifica(
  cientifica: EspecieCientificaConEspecies | null,
  onCerrar: () => void,
) {
  const invalidarEspecies = useInvalidarEspecies();
  const [nombre, setNombre] = useState(cientifica?.nombre ?? '');
  const [error, setError] = useState<string>();
  const [duplicado, setDuplicado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const mutacion = useMutation({
    mutationFn: async (limpio: string) => {
      if (cientifica) return editarEspecieCientifica(cientifica.id, limpio);
      await crearEspecieCientifica(limpio);
    },
    onSuccess: async () => {
      await invalidarEspecies();
      onCerrar();
    },
    onError: (falla) => {
      if (falla instanceof NombreCientificoDuplicadoError) setDuplicado(true);
      else setErrorEnvio(mensajeDeError(falla, ACCION_GUARDAR));
    },
  });

  function cambiarNombre(valor: string) {
    setNombre(valor);
    setDuplicado(false);
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErrorEnvio(null);
    const errorNombre = validarNombreCientifico(nombre);
    setError(errorNombre);
    if (!errorNombre) mutacion.mutate(nombre.trim());
  }

  return {
    nombre,
    cambiarNombre,
    error,
    duplicado,
    errorEnvio,
    enviar,
    guardando: mutacion.isPending,
  };
}
