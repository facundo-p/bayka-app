import { useParams } from 'react-router';
import { SEGMENTO_DATOS } from '../../lib/rutas';
import type { GrupoConDetalle } from '../../queries/dataExplorerQueries';
import { COLUMNAS_GRUPOS } from './columnas';
import { filtrosAParams } from './filtrosUrl';
import { SeccionTablaDatos, type TextosSeccion } from './SeccionTablaDatos';
import { SelectParcela } from './SelectParcela';
import { useFiltrosDatos } from './useFiltrosDatos';
import { useIrASeccion } from './useIrASeccion';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';

const TEXTOS: TextosSeccion = {
  unidad: 'grupos',
  cargando: 'Cargando grupos…',
  error: 'No se pudieron cargar los grupos.',
  pie: 'Clic en una fila abre los árboles del grupo',
  vacio: 'Sin grupos para mostrar',
};

const VACIO_CON_FILTROS = 'Ningún grupo coincide con los filtros';

/** El drill-down a Árboles conserva el scope de parcela. */
function useGruposSection() {
  const { id = '' } = useParams();
  const irA = useIrASeccion();
  const { filtros, setFiltro, hayFiltro, limpiar } = useFiltrosDatos();
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtros.parcelaId);
  const verArboles = (grupo: GrupoConDetalle) =>
    irA(
      SEGMENTO_DATOS.arboles,
      filtrosAParams({ parcelaId: filtros.parcelaId, groupId: grupo.id }),
    );
  return {
    parcelaId: filtros.parcelaId,
    parcelas,
    grupos,
    verArboles,
    elegirParcela: (valor: string) => setFiltro('parcelaId', valor),
    vacioConFiltros: hayFiltro ? { mensaje: VACIO_CON_FILTROS, onLimpiar: limpiar } : undefined,
  };
}

/** Grupos de la plantación, filtrables por parcela; cada fila abre sus árboles. */
export function GruposSection() {
  const seccion = useGruposSection();
  return (
    <SeccionTablaDatos
      segmento={SEGMENTO_DATOS.grupos}
      consultas={[seccion.parcelas, seccion.grupos]}
      filas={seccion.grupos.data}
      textos={TEXTOS}
      columnas={COLUMNAS_GRUPOS}
      onRowClick={seccion.verArboles}
      vacioConFiltros={seccion.vacioConFiltros}
    >
      <SelectParcela
        parcelas={seccion.parcelas.data ?? []}
        value={seccion.parcelaId}
        onChange={seccion.elegirParcela}
      />
    </SeccionTablaDatos>
  );
}
