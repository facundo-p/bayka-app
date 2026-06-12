import { useParams } from 'react-router';
import { Cargando, ErrorConReintento, Table, type TableColumn } from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
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
  { key: 'grupos', header: 'Grupos', align: 'right' },
  { key: 'arboles', header: 'Árboles', align: 'right' },
  {
    key: 'createdAt',
    header: 'Creada',
    render: (parcela) => formatearFechaCorta(parcela.createdAt),
  },
];

/** Sección Parcelas de la tab Datos: tabla de parcelas activas con counts. */
export function ParcelasSection() {
  const { id = '' } = useParams();
  const { data, isPending, isError, refetch } = useParcelasDatos(id);

  if (isPending) return <Cargando />;
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
      emptyMessage="La plantación todavía no tiene parcelas"
    />
  );
}
