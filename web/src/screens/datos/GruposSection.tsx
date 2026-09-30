import { useIdPlantacion } from '../../hooks/useIdPlantacion';
import { SEGMENTO_DATOS } from '../../lib/rutas';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { GrupoConDetalle } from '../../queries/dataExplorerQueries';
import { BuscadorCodigoNombre } from './BuscadorCodigoNombre';
import { filtrarPorCodigoNombre } from './busquedaCodigoNombre';
import { COLUMNAS_GRUPOS } from './columnas';
import { filtrosAParams } from './filtrosUrl';
import { SeccionTablaDatos, type TextosSeccion } from './SeccionTablaDatos';
import { SelectParcela } from './SelectParcela';
import { useBusquedaDatos } from './useFiltrosDatos';
import { useIrASeccion } from './useIrASeccion';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';

const TEXTOS: TextosSeccion = {
  unidad: SUSTANTIVO.grupo,
  cargando: 'Cargando grupos…',
  error: 'No se pudieron cargar los grupos.',
  pie: 'Clic en una fila abre los árboles del grupo',
  vacio: 'Sin grupos para mostrar',
  vacioConFiltros: 'Ningún grupo coincide con los filtros',
};

/** El drill-down a Árboles conserva el scope de parcela. */
function useGruposSection() {
  const id = useIdPlantacion();
  const irA = useIrASeccion();
  const { filtros, setFiltro, buscar, filtrosSeccion } = useBusquedaDatos();
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtros.parcelaId);
  const verArboles = (grupo: GrupoConDetalle) =>
    irA(
      SEGMENTO_DATOS.arboles,
      filtrosAParams({ parcelaId: filtros.parcelaId, groupId: grupo.id }),
    );
  return {
    filtros,
    parcelas,
    grupos,
    visibles: filtrarPorCodigoNombre(grupos.data, filtros.busqueda),
    verArboles,
    elegirParcela: (valor: string) => setFiltro('parcelaId', valor),
    buscar,
    filtrosSeccion,
  };
}

/** Grupos de la plantación, filtrables por parcela y por búsqueda; cada fila abre sus árboles. */
export function GruposSection() {
  const seccion = useGruposSection();
  return (
    <SeccionTablaDatos
      segmento={SEGMENTO_DATOS.grupos}
      consultas={[seccion.parcelas, seccion.grupos]}
      filas={seccion.visibles}
      textos={TEXTOS}
      columnas={COLUMNAS_GRUPOS}
      onRowClick={seccion.verArboles}
      filtros={seccion.filtrosSeccion}
    >
      <BuscadorCodigoNombre value={seccion.filtros.busqueda} onChange={seccion.buscar} />
      <SelectParcela
        parcelas={seccion.parcelas.data ?? []}
        value={seccion.filtros.parcelaId}
        onChange={seccion.elegirParcela}
      />
    </SeccionTablaDatos>
  );
}
