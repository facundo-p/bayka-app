import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarPlantaciones } from '../../queries/plantationQueries';
import type { ResultadoBusqueda } from '../../queries/buscarQueries';
import { useCommandMenu } from '../../hooks/useCommandMenu';
import { accionesRapidas, filtrarAcciones } from './accionesRapidas';
import { SECCION_RECIENTES, construirItems, type ItemPaleta, type Seccion } from './construirItems';
import { sugerencias } from './sugerencias';
import { useResultadosBusqueda } from './useResultadosBusqueda';

const TITULO_SUGERENCIAS = 'Sugerencias';

export type ContenidoPaleta = {
  secciones: Seccion[];
  /** Orden del teclado: el `indice` de cada ítem de `secciones` apunta acá. */
  itemsPlanos: ItemPaleta[];
  /** Encabezado de la lista sin texto; `null` mientras se busca. */
  encabezadoVacio: string | null;
};

/** Sin recientes guardados, el estado vacío sugiere plantaciones. */
function useRecientesOSugerencias(recientes: ResultadoBusqueda[]): ResultadoBusqueda[] {
  const { data: plantaciones } = useQuery({
    queryKey: CLAVE_QUERY.plantaciones(),
    queryFn: listarPlantaciones,
  });
  return useMemo(
    () => (recientes.length > 0 ? recientes : sugerencias(plantaciones ?? [])),
    [recientes, plantaciones],
  );
}

function encabezadoVacio(hayTexto: boolean, hayRecientes: boolean): string | null {
  if (hayTexto) return null;
  return hayRecientes ? SECCION_RECIENTES.titulo : TITULO_SUGERENCIAS;
}

/** Secciones de la paleta para `busqueda`: sin texto, recientes o sugerencias; con texto,
 *  acciones rápidas filtradas y resultados de la búsqueda remota. */
export function useSeccionesCommandMenu(busqueda: string): ContenidoPaleta {
  const { scope, recientes } = useCommandMenu();
  const resultados = useResultadosBusqueda(busqueda, scope ?? undefined);
  const recientesOSugerencias = useRecientesOSugerencias(recientes);
  const hayTexto = busqueda.trim().length > 0;
  const acciones = useMemo(
    () => filtrarAcciones(accionesRapidas(scope), busqueda),
    [scope, busqueda],
  );
  const armado = useMemo(
    () => construirItems({ acciones, resultados, recientes: recientesOSugerencias, hayTexto }),
    [acciones, resultados, recientesOSugerencias, hayTexto],
  );
  return { ...armado, encabezadoVacio: encabezadoVacio(hayTexto, recientes.length > 0) };
}
