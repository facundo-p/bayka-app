import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useColoresEspecie } from '../../hooks/useColoresEspecie';
import { useCatalogoEspecies } from '../../hooks/useCatalogoEspecies';
import { useDebounce } from '../../hooks/useDebounce';
import { useIdPlantacion } from '../../hooks/useIdPlantacion';
import { usePerfiles } from '../../hooks/usePerfiles';
import { usePlantacion } from '../../hooks/usePlantacion';
import { nombreVisible } from '../../lib/presentacionUsuario';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  listarArboles,
  type ArbolDetalle,
  type ParcelaConStats,
} from '../../queries/dataExplorerQueries';
import type { Plantacion } from '../../queries/plantationQueries';
import { descargarFichaPdf, type ContextoFichaPdf } from '../../services/pdfFicha';
import { puedeCambiarEspecie } from './cambioDeEspecie';
import { motivoParaNoEliminarFoto } from './eliminacionDeFoto';
import { aFiltrosArboles, type FiltrosUi } from './filtrosArboles';
import { filtrosAParams } from './filtrosUrl';
import { useFiltrosDatos } from './useFiltrosDatos';
import type { EdicionDeEspecie } from './useCambioDeEspecie';
import type { EliminacionDeFoto } from './useEliminarFoto';
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
  return { arboles, pagina, setPagina, filtrosAplicados: aFiltrosArboles(aplicados) };
}

function mapaPorId<T extends { id: string }>(filas: T[] | undefined, valor: (fila: T) => string) {
  return new Map((filas ?? []).map((fila) => [fila.id, valor(fila)]));
}

/** Parcela y nombre de técnico por id, para las columnas y el panel. */
function useMapasArboles(parcelas: ParcelaConStats[] | undefined) {
  const perfiles = usePerfiles();
  return {
    codigosParcela: mapaPorId(parcelas, (parcela) => parcela.codigo),
    parcelasPorId: new Map(
      (parcelas ?? []).map(({ id, codigo, nombre }) => [id, { codigo, nombre }]),
    ),
    nombresUsuario: mapaPorId(perfiles.data, (perfil) => nombreVisible(perfil.nombre, perfil.id)),
    perfilesCargando: perfiles.isPending,
  };
}

/** undefined si el perfil no puede cambiar especies en esta plantación. */
function useEdicionDeEspecie(
  plantationId: string,
  plantacion: Plantacion | null | undefined,
  onActualizado: (arbol: ArbolDetalle) => void,
): EdicionDeEspecie | undefined {
  const { perfil } = useAuth();
  if (!plantacion || !puedeCambiarEspecie(perfil, plantacion)) return undefined;
  return { plantationId, codigoPlantacion: plantacion.codigo, onActualizado };
}

function useEliminacionDeFoto(
  plantacion: Plantacion | null | undefined,
  onActualizado: (arbol: ArbolDetalle) => void,
): EliminacionDeFoto {
  const { perfil } = useAuth();
  return { motivoBloqueo: motivoParaNoEliminarFoto(perfil, plantacion), onActualizado };
}

/**
 * Lo que necesita la ficha PDF. null (botón deshabilitado) hasta tener la
 * plantación y los técnicos: antes saldría «Técnico —».
 */
function useContextoFicha(
  plantacion: Plantacion | null | undefined,
  { nombresUsuario, perfilesCargando }: ReturnType<typeof useMapasArboles>,
): ContextoFichaPdf | null {
  const queryClient = useQueryClient();
  if (!plantacion || perfilesCargando) return null;
  return { plantacion, nombresUsuario, queryClient };
}

function descargaFichaDe(contexto: ContextoFichaPdf | null) {
  return (arbol: ArbolDetalle): (() => Promise<void>) | null =>
    contexto && (() => descargarFichaPdf(arbol.id, contexto));
}

/**
 * Estado y datos de la sección Árboles: filtros en la URL, página, catálogos
 * de los selects y el árbol abierto en el panel. El componente queda solo con
 * presentación.
 */
export function useArbolesSection() {
  const id = useIdPlantacion();
  const filtrosDatos = useFiltrosDatos();
  const [arbolSeleccionado, setArbolSeleccionado] = useState<ArbolDetalle | null>(null);
  const parcelas = useParcelasDatos(id);
  const plantacion = usePlantacion(id).data;
  const grupos = useGruposDatos(id, filtrosDatos.filtros.parcelaId);
  const especies = useCatalogoEspecies();
  const mapas = useMapasArboles(parcelas.data);
  const paginaArboles = usePaginaArboles(id, filtrosDatos.filtros);
  // La respuesta puede llegar con otro árbol ya abierto: solo se actualiza el mismo.
  const actualizarArbol = (arbol: ArbolDetalle) =>
    setArbolSeleccionado((abierto) => (abierto?.id === arbol.id ? arbol : abierto));
  const edicionDeEspecie = useEdicionDeEspecie(id, plantacion, actualizarArbol);
  const eliminacionDeFoto = useEliminacionDeFoto(plantacion, actualizarArbol);
  const colores = useColoresEspecie(id);
  const contextoFicha = useContextoFicha(plantacion, mapas);
  return {
    ...filtrosDatos,
    ...paginaArboles,
    ...mapas,
    parcelas,
    plantacion,
    grupos,
    especies,
    arbolSeleccionado,
    setArbolSeleccionado,
    edicionDeEspecie,
    eliminacionDeFoto,
    descargaFichaDe: descargaFichaDe(contextoFicha),
    colores,
  };
}
