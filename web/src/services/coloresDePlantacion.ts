/*
 * Colores de especie de una plantación (#777, #845): salen del lugar fijo de cada
 * especie habilitada. Usa la clave del selector de especies, así comparten caché
 * y se invalidan juntos cuando se habilita o quita una especie.
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarEspeciesDePlantacion, type EspecieDePlantacion } from '../queries/especieQueries';
import {
  colorEspeciePorCodigo,
  coloresDeEspecies,
  type ColorEspecie,
} from '../theme/coloresEspecie';

export function consultaEspeciesHabilitadas(plantationId: string) {
  return queryOptions({
    queryKey: CLAVE_QUERY.especiesHabilitadas(plantationId),
    queryFn: () => listarEspeciesDePlantacion(plantationId),
  });
}

/** Sin especies legibles (undefined), cada código se pinta por su hash: el mismo respaldo en todas las vistas. */
export function coloresDeHabilitadas(
  especies: readonly EspecieDePlantacion[] | undefined,
): ColorEspecie {
  return especies ? coloresDeEspecies(especies) : colorEspeciePorCodigo;
}

/** Para las descargas: si las especies no se leen, la descarga sale igual (undefined). */
export function leerEspeciesHabilitadas(
  queryClient: QueryClient,
  plantationId: string,
): Promise<EspecieDePlantacion[] | undefined> {
  return queryClient.fetchQuery(consultaEspeciesHabilitadas(plantationId)).catch(() => undefined);
}

export async function leerColoresEspecie(
  queryClient: QueryClient,
  plantationId: string,
): Promise<ColorEspecie> {
  return coloresDeHabilitadas(await leerEspeciesHabilitadas(queryClient, plantationId));
}
