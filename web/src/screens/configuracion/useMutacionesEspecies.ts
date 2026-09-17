import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { EspecieCatalogo, EspecieConUso } from '../../queries/especieQueries';
import {
  agregarEspecie,
  quitarEspecie,
  sincronizarEspecies,
} from '../../repositories/plantationSpeciesRepository';

export type Toggle = { speciesId: string; habilitar: boolean; orden: number };
export type Sincronizacion = { idsHabilitar: string[]; idsQuitar: string[]; ordenInicial: number };

/** El checklist refleja el cambio antes de que responda la base; si falla, vuelve atrás. */
export function useMutacionOptimistaEspecies<V>(
  plantationId: string,
  mutationFn: (variables: V) => Promise<unknown>,
  aplicar: (previas: EspecieConUso[], variables: V) => EspecieConUso[],
) {
  const queryClient = useQueryClient();
  const clave = CLAVE_QUERY.plantacionEspecies(plantationId);
  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: clave });
      const previas = queryClient.getQueryData<EspecieConUso[]>(clave) ?? [];
      queryClient.setQueryData<EspecieConUso[]>(clave, aplicar(previas, variables));
      return { previas };
    },
    onError: (_error, _variables, contexto) =>
      contexto && queryClient.setQueryData(clave, contexto.previas),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });
}

/** El orden_visual es el de alta: la especie nueva va al final. */
function comoHabilitada(especie: EspecieCatalogo, ordenVisual: number): EspecieConUso {
  return { ...especie, ordenVisual, tieneArboles: false };
}

export function aplicarToggle(
  previas: EspecieConUso[],
  catalogo: EspecieCatalogo[],
  { speciesId, habilitar }: Pick<Toggle, 'speciesId' | 'habilitar'>,
): EspecieConUso[] {
  if (!habilitar) return previas.filter((especie) => especie.id !== speciesId);
  const base = catalogo.find((especie) => especie.id === speciesId);
  return base ? [...previas, comoHabilitada(base, previas.length)] : previas;
}

export function aplicarSincronizacion(
  previas: EspecieConUso[],
  catalogo: EspecieCatalogo[],
  { idsHabilitar, idsQuitar }: Pick<Sincronizacion, 'idsHabilitar' | 'idsQuitar'>,
): EspecieConUso[] {
  const quitar = new Set(idsQuitar);
  const conservadas = previas.filter((especie) => !quitar.has(especie.id));
  const altas = idsHabilitar
    .map((speciesId) => catalogo.find((especie) => especie.id === speciesId))
    .filter((especie): especie is EspecieCatalogo => Boolean(especie))
    .map((especie, indice) => comoHabilitada(especie, conservadas.length + indice));
  return [...conservadas, ...altas];
}

/** `orden` lo pone quien llama: la cantidad habilitada, para ir al final. */
export function useToggleEspecie(plantationId: string, catalogo: EspecieCatalogo[]) {
  return useMutacionOptimistaEspecies(
    plantationId,
    ({ speciesId, habilitar, orden }: Toggle) =>
      habilitar
        ? agregarEspecie(plantationId, speciesId, orden)
        : quitarEspecie(plantationId, speciesId),
    (previas, toggle) => aplicarToggle(previas, catalogo, toggle),
  );
}

/** Marcar o desmarcar todas: el lote de altas y bajas en una sola mutación. */
export function useSincronizarEspecies(plantationId: string, catalogo: EspecieCatalogo[]) {
  return useMutacionOptimistaEspecies(
    plantationId,
    ({ idsHabilitar, idsQuitar, ordenInicial }: Sincronizacion) =>
      sincronizarEspecies(plantationId, idsHabilitar, idsQuitar, ordenInicial),
    (previas, lote) => aplicarSincronizacion(previas, catalogo, lote),
  );
}
