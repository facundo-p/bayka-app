import { useMutation, useQueryClient } from '@tanstack/react-query';
import { porNombre } from '../../lib/ordenEspecies';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { EspecieCatalogo, EspecieConUso } from '../../queries/especieQueries';
import { aplicarCambiosEspecies } from '../../repositories/plantationSpeciesRepository';

export type Toggle = { speciesId: string; habilitar: boolean };
export type Sincronizacion = { idsHabilitar: string[]; idsQuitar: string[] };

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

function comoHabilitada(especie: EspecieCatalogo): EspecieConUso {
  return { ...especie, tieneArboles: false };
}

export function aplicarSincronizacion(
  previas: EspecieConUso[],
  catalogo: EspecieCatalogo[],
  { idsHabilitar, idsQuitar }: Sincronizacion,
): EspecieConUso[] {
  const quitar = new Set(idsQuitar);
  const yaEstan = new Set(previas.map((especie) => especie.id));
  const conservadas = previas.filter((especie) => !quitar.has(especie.id));
  const altas = catalogo
    .filter((especie) => idsHabilitar.includes(especie.id) && !yaEstan.has(especie.id))
    .map(comoHabilitada);
  return porNombre([...conservadas, ...altas]);
}

function comoSincronizacion({ speciesId, habilitar }: Toggle): Sincronizacion {
  return habilitar
    ? { idsHabilitar: [speciesId], idsQuitar: [] }
    : { idsHabilitar: [], idsQuitar: [speciesId] };
}

export function aplicarToggle(
  previas: EspecieConUso[],
  catalogo: EspecieCatalogo[],
  toggle: Toggle,
): EspecieConUso[] {
  return aplicarSincronizacion(previas, catalogo, comoSincronizacion(toggle));
}

function guardar(plantationId: string, { idsHabilitar, idsQuitar }: Sincronizacion) {
  return aplicarCambiosEspecies(plantationId, { altas: idsHabilitar, bajas: idsQuitar });
}

export function useToggleEspecie(plantationId: string, catalogo: EspecieCatalogo[]) {
  return useMutacionOptimistaEspecies(
    plantationId,
    (toggle: Toggle) => guardar(plantationId, comoSincronizacion(toggle)),
    (previas, toggle) => aplicarToggle(previas, catalogo, toggle),
  );
}

/**
 * Marcar o desmarcar todas: el lote de altas y bajas en una sola mutación y una sola
 * transacción del server (#548). Solo viajan los cambios, no la lista final: una lista
 * pisaría lo que un teléfono cambió en otras especies (#635).
 */
export function useSincronizarEspecies(plantationId: string, catalogo: EspecieCatalogo[]) {
  return useMutacionOptimistaEspecies(
    plantationId,
    (lote: Sincronizacion) => guardar(plantationId, lote),
    (previas, lote) => aplicarSincronizacion(previas, catalogo, lote),
  );
}
