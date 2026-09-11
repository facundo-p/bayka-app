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

/** Qué muestra la lista cuando no tiene ítems. */
export const AVISO_VACIO = {
  sinResultados: 'sin-resultados',
  cargando: 'cargando',
  nadaQueSugerir: 'nada-que-sugerir',
} as const;
export type AvisoVacio = (typeof AVISO_VACIO)[keyof typeof AVISO_VACIO];

export type ContenidoPaleta = {
  secciones: Seccion[];
  /** Orden del teclado: el `indice` de cada ítem de `secciones` apunta acá. */
  itemsPlanos: ItemPaleta[];
  /** `null` mientras haya ítems. */
  avisoVacio: AvisoVacio | null;
};

function usePlantacionesSugeridas(): { sugeridas: ResultadoBusqueda[]; cargando: boolean } {
  const { data: plantaciones, isPending } = useQuery({
    queryKey: CLAVE_QUERY.plantaciones(),
    queryFn: listarPlantaciones,
  });
  const sugeridas = useMemo(() => sugerencias(plantaciones ?? []), [plantaciones]);
  return { sugeridas, cargando: isPending };
}

/** Sin texto no hubo búsqueda: la lista vacía es que las sugerencias todavía cargan o que
 *  no hay recientes ni plantaciones para sugerir. */
function avisoDeListaVacia(
  items: ItemPaleta[],
  hayTexto: boolean,
  cargando: boolean,
): AvisoVacio | null {
  if (items.length > 0) return null;
  if (hayTexto) return AVISO_VACIO.sinResultados;
  return cargando ? AVISO_VACIO.cargando : AVISO_VACIO.nadaQueSugerir;
}

/** Secciones de la paleta para `busqueda`: sin texto, recientes o sugerencias; con texto,
 *  acciones rápidas filtradas y resultados de la búsqueda remota. */
export function useSeccionesCommandMenu(busqueda: string): ContenidoPaleta {
  const { scope, recientes } = useCommandMenu();
  const resultados = useResultadosBusqueda(busqueda, scope ?? undefined);
  const { sugeridas, cargando } = usePlantacionesSugeridas();
  const hayTexto = busqueda.trim().length > 0;
  const acciones = useMemo(
    () => filtrarAcciones(accionesRapidas(scope), busqueda),
    [scope, busqueda],
  );
  const armado = useMemo(
    () => construirItems({ acciones, resultados, recientes, sugerencias: sugeridas, hayTexto }),
    [acciones, resultados, recientes, sugeridas, hayTexto],
  );
  return { ...armado, avisoVacio: avisoDeListaVacia(armado.itemsPlanos, hayTexto, cargando) };
}
