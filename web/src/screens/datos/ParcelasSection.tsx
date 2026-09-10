import { useNavigate, useParams } from 'react-router';
import {
  Cargando,
  CardTabla,
  ErrorConReintento,
  Table,
} from '../../components';
import { formatearEntero } from '../../lib/formato';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { DatosToolbar } from './DatosToolbar';
import { filtrosAParams } from './filtrosUrl';
import { useParcelasDatos } from './useDatosQueries';
import { COLUMNAS_PARCELAS } from './columnas';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';

/** Sección Parcelas de la tab Datos: tabla de parcelas activas con counts. */
export function ParcelasSection() {
  const columnas = useColumnasVisibles(COLUMNAS_PARCELAS);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useParcelasDatos(id);

  /** Drill-down: abrir los grupos de la parcela pre-filtrados por ella. */
  const verGrupos = (parcela: ParcelaConStats) => {
    const params = filtrosAParams({ parcelaId: parcela.id });
    void navigate(`../grupos?${params.toString()}`);
  };

  if (isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudieron cargar las parcelas."
        onReintentar={() => void refetch()}
      />
    );
  }
  const recuento = data ? `${formatearEntero(data.length)} parcelas` : undefined;
  return (
    <>
      <DatosToolbar segmento="parcelas" recuento={recuento} />
      {isPending ? (
        <Cargando label="Cargando parcelas…" />
      ) : (
        <CardTabla pie="Clic en una fila abre los grupos de la parcela">
          <Table
            columns={columnas}
            rows={data}
            getRowKey={(parcela) => parcela.id}
            onRowClick={verGrupos}
            emptyMessage="La plantación todavía no tiene parcelas"
          />
        </CardTabla>
      )}
    </>
  );
}
