import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarPlantaciones } from '../../queries/plantationQueries';
import type { ResultadoBusqueda } from '../../queries/buscarQueries';
import { useCommandMenu } from '../../hooks/useCommandMenu';
import { accionesRapidas, filtrarAcciones } from './accionesRapidas';
import { construirItems, type ItemPaleta, type Seccion } from './construirItems';
import { sugerencias } from './sugerencias';
import { useResultadosBusqueda } from './useResultadosBusqueda';

export type ContenidoPaleta = {
  secciones: Seccion[];
  /** Orden del teclado: el `indice` de cada ítem de `secciones` apunta acá. */
  itemsPlanos: ItemPaleta[];
};

function usePlantacionesSugeridas(): ResultadoBusqueda[] {
  const { data: plantaciones } = useQuery({
    queryKey: CLAVE_QUERY.plantaciones(),
    queryFn: listarPlantaciones,
  });
  return useMemo(() => sugerencias(plantaciones ?? []), [plantaciones]);
}

/** Secciones de la paleta para `busqueda`: sin texto, recientes o sugerencias; con texto,
 *  acciones rápidas filtradas y resultados de la búsqueda remota. */
export function useSeccionesCommandMenu(busqueda: string): ContenidoPaleta {
  const { scope, recientes } = useCommandMenu();
  const resultados = useResultadosBusqueda(busqueda, scope ?? undefined);
  const sugeridas = usePlantacionesSugeridas();
  const hayTexto = busqueda.trim().length > 0;
  const acciones = useMemo(
    () => filtrarAcciones(accionesRapidas(scope), busqueda),
    [scope, busqueda],
  );
  return useMemo(
    () => construirItems({ acciones, resultados, recientes, sugerencias: sugeridas, hayTexto }),
    [acciones, resultados, recientes, sugeridas, hayTexto],
  );
}
