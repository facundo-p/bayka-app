import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCatalogoEspecies } from '../../hooks/useCatalogoEspecies';
import { useDebounce } from '../../hooks/useDebounce';
import { usePerfiles } from '../../hooks/usePerfiles';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarArboles, type ArbolDetalle } from '../../queries/dataExplorerQueries';
import { aFiltrosArboles } from './filtrosArboles';
import { useFiltrosDatos } from './useFiltrosDatos';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';

/** Retardo del debounce de la búsqueda por ID, en ms. */
const RETARDO_BUSQUEDA_MS = 300;

/**
 * Estado y datos de la sección Árboles: filtros persistidos en URL, búsqueda
 * con debounce, las cinco queries (parcelas/grupos/especies/perfiles/árboles)
 * y el detalle seleccionado. El componente que lo consume queda solo con
 * presentación.
 */
export function useArbolesSection() {
  const { id = '' } = useParams();
  const { filtros, setFiltro, hayFiltro, limpiar } = useFiltrosDatos();
  const [pagina, setPagina] = useState(1);
  const [arbolSeleccionado, setArbolSeleccionado] = useState<ArbolDetalle | null>(null);
  const busquedaDebounced = useDebounce(filtros.busqueda, RETARDO_BUSQUEDA_MS);
  const filtrosQuery = { ...filtros, busqueda: busquedaDebounced };

  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtros.parcelaId);
  const especies = useCatalogoEspecies();
  const perfiles = usePerfiles();
  const arboles = useQuery({
    queryKey: CLAVE_QUERY.datosArboles(id, filtrosQuery, pagina),
    queryFn: () => listarArboles(id, aFiltrosArboles(filtrosQuery), pagina),
    placeholderData: keepPreviousData,
  });

  const codigosParcela = new Map(
    (parcelas.data ?? []).map((parcela) => [parcela.id, parcela.codigo]),
  );
  const nombresUsuario = new Map(
    (perfiles.data ?? []).map((perfil) => [perfil.id, perfil.nombre]),
  );

  /** Cualquier cambio de filtro vuelve a la página 1. */
  useEffect(
    () => setPagina(1),
    [
      filtros.parcelaId,
      filtros.groupId,
      filtros.speciesId,
      filtros.gps,
      filtros.foto,
      busquedaDebounced,
    ],
  );

  return {
    filtros,
    setFiltro,
    hayFiltro,
    limpiar,
    parcelas,
    grupos,
    especies,
    perfiles,
    arboles,
    codigosParcela,
    nombresUsuario,
    pagina,
    setPagina,
    arbolSeleccionado,
    setArbolSeleccionado,
  };
}
