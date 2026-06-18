import { useNavigate, useParams } from 'react-router';
import { Cargando, ErrorConReintento, Table, type TableColumn } from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import { formatearEntero } from '../../lib/formato';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { filtrosAParams } from './filtrosUrl';
import { useParcelasDatos } from './useDatosQueries';
import styles from './SeccionesDatos.module.css';

function CeldaDescripcion({ descripcion }: { descripcion: string | null }) {
  if (!descripcion) return <>—</>;
  return (
    <span className={styles.descripcion} title={descripcion}>
      {descripcion}
    </span>
  );
}

const COLUMNAS: Array<TableColumn<ParcelaConStats>> = [
  { key: 'nombre', header: 'Nombre' },
  {
    key: 'codigo',
    header: 'Código',
    render: (parcela) => <span className={styles.codigo}>{parcela.codigo}</span>,
  },
  {
    key: 'descripcion',
    header: 'Descripción',
    render: (parcela) => <CeldaDescripcion descripcion={parcela.descripcion} />,
  },
  {
    key: 'grupos',
    header: 'Grupos',
    align: 'right',
    render: (parcela) => <span className={styles.numero}>{formatearEntero(parcela.grupos)}</span>,
  },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'right',
    render: (parcela) => <span className={styles.numero}>{formatearEntero(parcela.arboles)}</span>,
  },
  {
    key: 'createdAt',
    header: 'Creada',
    render: (parcela) => formatearFechaCorta(parcela.createdAt),
  },
];

/** Sección Parcelas de la tab Datos: tabla de parcelas activas con counts. */
export function ParcelasSection() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useParcelasDatos(id);

  /** Drill-down: abrir los grupos de la parcela pre-filtrados por ella. */
  const verGrupos = (parcela: ParcelaConStats) => {
    const params = filtrosAParams({ parcelaId: parcela.id });
    void navigate(`../grupos?${params.toString()}`);
  };

  if (isPending) return <Cargando label="Cargando parcelas…" />;
  if (isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudieron cargar las parcelas."
        onReintentar={() => void refetch()}
      />
    );
  }
  return (
    <Table
      columns={COLUMNAS}
      rows={data}
      getRowKey={(parcela) => parcela.id}
      onRowClick={verGrupos}
      emptyMessage="La plantación todavía no tiene parcelas"
    />
  );
}
