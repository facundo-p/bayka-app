import { useState } from 'react';
import { useParams } from 'react-router';
import {
  Cargando,
  ErrorConReintento,
  EstadoPlantacionBadge,
  Table,
  type TableColumn,
} from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import type { GrupoConDetalle, TipoGrupo } from '../../queries/dataExplorerQueries';
import { SelectParcela } from './SelectParcela';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';
import styles from './SeccionesDatos.module.css';

/* Etiquetas en español de los tipos de grupo. */
const ETIQUETA_TIPO: Record<TipoGrupo, string> = { linea: 'Línea', bosquete: 'Bosquete' };

const COLUMNAS: Array<TableColumn<GrupoConDetalle>> = [
  {
    key: 'codigo',
    header: 'Código',
    render: (grupo) => <span className={styles.codigo}>{grupo.codigo}</span>,
  },
  { key: 'nombre', header: 'Nombre' },
  {
    key: 'parcelaCodigo',
    header: 'Parcela',
    render: (grupo) => <span className={styles.codigo}>{grupo.parcelaCodigo}</span>,
  },
  { key: 'tipo', header: 'Tipo', render: (grupo) => ETIQUETA_TIPO[grupo.tipo] },
  {
    key: 'estado',
    header: 'Estado',
    // Grupos y plantaciones comparten los estados activa/finalizada: mismo badge.
    render: (grupo) => <EstadoPlantacionBadge estado={grupo.estado} />,
  },
  { key: 'arboles', header: 'Árboles', align: 'right' },
  {
    key: 'createdAt',
    header: 'Creado',
    render: (grupo) => formatearFechaCorta(grupo.createdAt),
  },
];

/** Sección Grupos de la tab Datos: tabla filtrable por parcela. */
export function GruposSection() {
  const { id = '' } = useParams();
  const [parcelaId, setParcelaId] = useState('');
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, parcelaId);
  const reintentar = () => void Promise.all([parcelas.refetch(), grupos.refetch()]);

  if (parcelas.isError || grupos.isError) {
    return (
      <ErrorConReintento mensaje="No se pudieron cargar los grupos." onReintentar={reintentar} />
    );
  }
  return (
    <>
      <div className={styles.filtros}>
        <SelectParcela parcelas={parcelas.data ?? []} value={parcelaId} onChange={setParcelaId} />
      </div>
      {grupos.isPending ? (
        <Cargando />
      ) : (
        <Table
          columns={COLUMNAS}
          rows={grupos.data}
          getRowKey={(grupo) => grupo.id}
          emptyMessage="Sin grupos para mostrar"
        />
      )}
    </>
  );
}
