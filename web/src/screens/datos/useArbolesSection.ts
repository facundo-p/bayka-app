import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { formatearEntero } from '../../lib/formato';
import { listarArboles, type ArbolDetalle } from '../../queries/dataExplorerQueries';
import { listarCatalogo } from '../../queries/especieQueries';
import { listarPerfiles } from '../../queries/usuarioQueries';
import type { ScopeChip } from './ScopeChips';
import { aFiltrosArboles, type FiltrosUi } from './filtrosArboles';
import { useFiltrosDatos } from './useFiltrosDatos';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';

/** Retardo del debounce de la búsqueda por ID, en ms. */
const RETARDO_BUSQUEDA_MS = 300;

/** Chips del scope heredado por drill-down (parcela y/o grupo). */
function scopeChips(
  filtros: FiltrosUi,
  setFiltro: (campo: keyof FiltrosUi, valor: string) => void,
  parcelas: ReturnType<typeof useParcelasDatos>,
  grupos: ReturnType<typeof useGruposDatos>,
): ScopeChip[] {
  const chips: ScopeChip[] = [];
  const parcela = parcelas.data?.find((item) => item.id === filtros.parcelaId);
  if (parcela) {
    chips.push({ etiqueta: `Parcela ${parcela.codigo}`, onQuitar: () => setFiltro('parcelaId', '') });
  }
  const grupo = grupos.data?.find((item) => item.id === filtros.groupId);
  if (grupo) {
    chips.push({ etiqueta: `Grupo ${grupo.codigo}`, onQuitar: () => setFiltro('groupId', '') });
  }
  return chips;
}

/**
 * Estado y datos de la sección Árboles: filtros persistidos en URL, búsqueda
 * con debounce, las cuatro queries (parcelas/grupos/especies/perfiles/árboles)
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
  const especies = useQuery({ queryKey: ['especies-catalogo'], queryFn: listarCatalogo });
  const perfiles = useQuery({ queryKey: ['perfiles'], queryFn: listarPerfiles });
  const arboles = useQuery({
    queryKey: ['datos-arboles', id, filtrosQuery, pagina],
    queryFn: () => listarArboles(id, aFiltrosArboles(filtrosQuery), pagina),
    placeholderData: keepPreviousData,
  });

  const chips = scopeChips(filtros, setFiltro, parcelas, grupos);
  const recuento = arboles.data ? `${formatearEntero(arboles.data.total)} árboles` : undefined;
  const codigosParcela = new Map(
    (parcelas.data ?? []).map((parcela) => [parcela.id, parcela.codigo]),
  );
  const nombresUsuario = new Map(
    (perfiles.data ?? []).map((perfil) => [perfil.id, perfil.nombre]),
  );

  /** Cualquier cambio de filtro vuelve a la página 1. */
  useEffect(
    () => setPagina(1),
    [filtros.parcelaId, filtros.groupId, filtros.speciesId, filtros.gps, busquedaDebounced],
  );

  return {
    filtros,
    setFiltro,
    hayFiltro,
    limpiar,
    parcelas,
    especies,
    perfiles,
    arboles,
    chips,
    recuento,
    codigosParcela,
    nombresUsuario,
    pagina,
    setPagina,
    arbolSeleccionado,
    setArbolSeleccionado,
  };
}
