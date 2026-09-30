import { useIdPlantacion } from '../../hooks/useIdPlantacion';
import { SEGMENTO_DATOS } from '../../lib/rutas';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { BuscadorCodigoNombre } from './BuscadorCodigoNombre';
import { filtrarPorCodigoNombre } from './busquedaCodigoNombre';
import { COLUMNAS_PARCELAS } from './columnas';
import { filtrosAParams } from './filtrosUrl';
import { SeccionTablaDatos, type TextosSeccion } from './SeccionTablaDatos';
import { useBusquedaDatos } from './useFiltrosDatos';
import { useParcelasDatos } from './useDatosQueries';
import { useIrASeccion } from './useIrASeccion';

const TEXTOS: TextosSeccion = {
  unidad: SUSTANTIVO.parcela,
  cargando: 'Cargando parcelas…',
  error: 'No se pudieron cargar las parcelas.',
  pie: 'Clic en una fila abre los grupos de la parcela',
  vacio: 'La plantación todavía no tiene parcelas',
  vacioConFiltros: 'Ninguna parcela coincide con la búsqueda',
};

/** Parcelas solo se filtra por la búsqueda: el scope de parcela que viaja en la URL no aplica. */
function useParcelasSection() {
  const irA = useIrASeccion();
  const { filtros, buscar, filtrosBusqueda } = useBusquedaDatos();
  const parcelas = useParcelasDatos(useIdPlantacion());
  return {
    parcelas,
    busqueda: filtros.busqueda,
    buscar,
    visibles: filtrarPorCodigoNombre(parcelas.data, filtros.busqueda),
    filtros: filtrosBusqueda,
    verGrupos: (parcela: ParcelaConStats) =>
      irA(SEGMENTO_DATOS.grupos, filtrosAParams({ parcelaId: parcela.id })),
  };
}

/** Parcelas activas con sus conteos; cada fila abre sus grupos. */
export function ParcelasSection() {
  const seccion = useParcelasSection();
  return (
    <SeccionTablaDatos
      segmento={SEGMENTO_DATOS.parcelas}
      consultas={[seccion.parcelas]}
      filas={seccion.visibles}
      textos={TEXTOS}
      columnas={COLUMNAS_PARCELAS}
      onRowClick={seccion.verGrupos}
      filtros={seccion.filtros}
    >
      <BuscadorCodigoNombre value={seccion.busqueda} onChange={seccion.buscar} />
    </SeccionTablaDatos>
  );
}
