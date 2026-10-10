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

export function coloresDeHabilitadas(especies: readonly EspecieDePlantacion[]): ColorEspecie {
  return coloresDeEspecies(especies.map((especie) => especie.codigo));
}

/** Para las descargas: si las especies no se leen, van todas en gris y la descarga sale igual. */
export async function leerColoresEspecie(
  queryClient: QueryClient,
  plantationId: string,
): Promise<ColorEspecie> {
  const especies = await queryClient
    .fetchQuery(consultaEspeciesHabilitadas(plantationId))
    .catch(() => []);
  return coloresDeHabilitadas(especies);
}
