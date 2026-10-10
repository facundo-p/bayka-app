/*
 * Colores de especie de una plantación (#777): salen de sus especies habilitadas.
 * Usa la clave del selector de especies, así comparten caché y se invalidan
 * juntos cuando se habilita o quita una especie.
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarEspeciesDePlantacion, type EspecieDePlantacion } from '../queries/especieQueries';
import { coloresDeEspecies, type ColorEspecie } from '../theme/coloresEspecie';

export function consultaEspeciesHabilitadas(plantationId: string) {
  return queryOptions({
    queryKey: CLAVE_QUERY.especiesHabilitadas(plantationId),
    queryFn: () => listarEspeciesDePlantacion(plantationId),
  });
}

/** Sin especies habilitadas legibles, los colores salen de los códigos `presentes`. */
export function coloresDeHabilitadas(
  especies: readonly EspecieDePlantacion[] | undefined,
  presentes: readonly string[],
): ColorEspecie {
  const catalogo = (especies ?? []).map((especie) => especie.codigo);
  return coloresDeEspecies(catalogo, presentes);
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
  presentes: readonly string[],
): Promise<ColorEspecie> {
  return coloresDeHabilitadas(await leerEspeciesHabilitadas(queryClient, plantationId), presentes);
}
