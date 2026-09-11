import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCatalogoEspecies } from '../../hooks/useCatalogoEspecies';
import { useDebounce } from '../../hooks/useDebounce';
import { usePerfiles } from '../../hooks/usePerfiles';
import { nombreVisible } from '../../lib/presentacionUsuario';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  listarArboles,
  type ArbolDetalle,
  type ParcelaConStats,
} from '../../queries/dataExplorerQueries';
import { aFiltrosArboles, type FiltrosUi } from './filtrosArboles';
import { filtrosAParams } from './filtrosUrl';
import { useFiltrosDatos } from './useFiltrosDatos';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';

/** Retardo del debounce de la búsqueda por ID, en ms. */
const RETARDO_BUSQUEDA_MS = 300;

/** Página server-side de árboles con los filtros aplicados. */
function usePaginaArboles(plantationId: string, filtros: FiltrosUi) {
  const [pagina, setPagina] = useState(1);
  const busqueda = useDebounce(filtros.busqueda, RETARDO_BUSQUEDA_MS);
  const aplicados = { ...filtros, busqueda };
  const arboles = useQuery({
    queryKey: CLAVE_QUERY.datosArboles(plantationId, aplicados, pagina),
    queryFn: () => listarArboles(plantationId, aFiltrosArboles(aplicados), pagina),
    placeholderData: keepPreviousData,
  });
  // Cualquier cambio de filtro vuelve a la página 1. La clave es el querystring
  // de los filtros aplicados: un filtro nuevo entra solo, sin sumarlo acá.
  const claveFiltros = filtrosAParams(aplicados).toString();
  useEffect(() => setPagina(1), [claveFiltros]);
  return { arboles, pagina, setPagina };
}

function mapaPorId<T extends { id: string }>(filas: T[] | undefined, valor: (fila: T) => string) {
  return new Map((filas ?? []).map((fila) => [fila.id, valor(fila)]));
}

/** Código de parcela y nombre de técnico por id, para las columnas y el panel. */
function useMapasArboles(parcelas: ParcelaConStats[] | undefined) {
  const perfiles = usePerfiles();
  return {
    codigosParcela: mapaPorId(parcelas, (parcela) => parcela.codigo),
    nombresUsuario: mapaPorId(perfiles.data, (perfil) => nombreVisible(perfil.nombre, perfil.id)),
  };
}

/**
 * Estado y datos de la sección Árboles: filtros en la URL, página, catálogos
 * de los selects y el árbol abierto en el panel. El componente queda solo con
 * presentación.
 */
export function useArbolesSection() {
  const { id = '' } = useParams();
  const filtrosDatos = useFiltrosDatos();
  const [arbolSeleccionado, setArbolSeleccionado] = useState<ArbolDetalle | null>(null);
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtrosDatos.filtros.parcelaId);
  const especies = useCatalogoEspecies();
  const mapas = useMapasArboles(parcelas.data);
  const paginaArboles = usePaginaArboles(id, filtrosDatos.filtros);
  return {
    ...filtrosDatos,
    ...paginaArboles,
    ...mapas,
    parcelas,
    grupos,
    especies,
    arbolSeleccionado,
    setArbolSeleccionado,
  };
}
