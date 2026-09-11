import { useQueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY, familia } from '../queries/clavesQuery';

/** Código y nombre de una especie se leen en el catálogo (checklist de
 *  Configuración, filtros de Árboles), en la pantalla de Especies y embebidos en
 *  el dashboard, el mapa y la tabla de Árboles de cada plantación. */
const CLAVES_CON_ESPECIES = [
  CLAVE_QUERY.especiesCatalogo(),
  CLAVE_QUERY.especiesCatalogoUso(),
  familia(CLAVE_QUERY.dashboard),
  familia(CLAVE_QUERY.mapa),
  familia(CLAVE_QUERY.datosArboles),
];

export function useInvalidarEspecies() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(CLAVES_CON_ESPECIES.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
