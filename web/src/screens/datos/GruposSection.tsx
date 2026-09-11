import { useNavigate, useParams } from 'react-router';
import {
  Cargando,
  CardTabla,
  ErrorConReintento,
  Table,
} from '../../components';
import { formatearEntero } from '../../lib/formato';
import type { GrupoConDetalle } from '../../queries/dataExplorerQueries';
import { DatosToolbar } from './DatosToolbar';
import { SelectParcela } from './SelectParcela';
import { VacioConFiltros } from './VacioConFiltros';
import { filtrosAParams } from './filtrosUrl';
import { rutaSeccion, SEGMENTO_DATOS } from './seccionesDatos';
import { useFiltrosDatos } from './useFiltrosDatos';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';
import { COLUMNAS_GRUPOS } from './columnas';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';

/** Sección Grupos de la tab Datos: tabla filtrable por parcela con drill-down. */
export function GruposSection() {
  const columnas = useColumnasVisibles(COLUMNAS_GRUPOS);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { filtros, setFiltro, hayFiltro, limpiar } = useFiltrosDatos();
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtros.parcelaId);
  const reintentar = () => void Promise.all([parcelas.refetch(), grupos.refetch()]);

  /** Drill-down: abrir los árboles del grupo manteniendo el scope de parcela. */
  const verArboles = (grupo: GrupoConDetalle) => {
    const params = filtrosAParams({ parcelaId: filtros.parcelaId, groupId: grupo.id });
    void navigate(rutaSeccion(SEGMENTO_DATOS.arboles, params));
  };

  if (parcelas.isError || grupos.isError) {
    return (
      <ErrorConReintento mensaje="No se pudieron cargar los grupos." onReintentar={reintentar} />
    );
  }
  const recuento = grupos.data ? `${formatearEntero(grupos.data.length)} grupos` : undefined;
  return (
    <>
      <DatosToolbar segmento={SEGMENTO_DATOS.grupos} recuento={recuento}>
        <SelectParcela
          parcelas={parcelas.data ?? []}
          value={filtros.parcelaId}
          onChange={(valor) => setFiltro('parcelaId', valor)}
        />
      </DatosToolbar>
      {grupos.isPending ? (
        <Cargando label="Cargando grupos…" />
      ) : grupos.data.length === 0 && hayFiltro ? (
        <VacioConFiltros mensaje="Ningún grupo coincide con los filtros" onLimpiar={limpiar} />
      ) : (
        <CardTabla pie="Clic en una fila abre los árboles del grupo">
          <Table
            columns={columnas}
            rows={grupos.data}
            getRowKey={(grupo) => grupo.id}
            onRowClick={verArboles}
            emptyMessage="Sin grupos para mostrar"
          />
        </CardTabla>
      )}
    </>
  );
}
