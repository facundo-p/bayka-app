import { useNavigate, useParams } from 'react-router';
import {
  Cargando,
  ErrorConReintento,
  EstadoPlantacionBadge,
  Table,
  type TableColumn,
} from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import { formatearEntero } from '../../lib/formato';
import type { GrupoConDetalle, TipoGrupo } from '../../queries/dataExplorerQueries';
import { DatosToolbar } from './DatosToolbar';
import { ScopeChips } from './ScopeChips';
import { SelectParcela } from './SelectParcela';
import { VacioConFiltros } from './VacioConFiltros';
import { filtrosAParams } from './filtrosUrl';
import { useFiltrosDatos } from './useFiltrosDatos';
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
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'center',
    render: (grupo) => <span className={styles.numero}>{formatearEntero(grupo.arboles)}</span>,
  },
  {
    key: 'createdAt',
    header: 'Creado',
    render: (grupo) => formatearFechaCorta(grupo.createdAt),
  },
];

/** Sección Grupos de la tab Datos: tabla filtrable por parcela con drill-down. */
export function GruposSection() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { filtros, setFiltro, hayFiltro, limpiar } = useFiltrosDatos();
  const quitarParcela = () => setFiltro('parcelaId', '');
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtros.parcelaId);
  const reintentar = () => void Promise.all([parcelas.refetch(), grupos.refetch()]);

  /** Drill-down: abrir los árboles del grupo manteniendo el scope de parcela. */
  const verArboles = (grupo: GrupoConDetalle) => {
    const params = filtrosAParams({ parcelaId: filtros.parcelaId, groupId: grupo.id });
    void navigate(`../arboles?${params.toString()}`);
  };

  const parcelaEnScope = parcelas.data?.find((parcela) => parcela.id === filtros.parcelaId);
  const chips = parcelaEnScope
    ? [{ etiqueta: `Parcela ${parcelaEnScope.codigo}`, onQuitar: quitarParcela }]
    : [];

  if (parcelas.isError || grupos.isError) {
    return (
      <ErrorConReintento mensaje="No se pudieron cargar los grupos." onReintentar={reintentar} />
    );
  }
  const recuento = grupos.data ? `${formatearEntero(grupos.data.length)} grupos` : undefined;
  return (
    <>
      <DatosToolbar segmento="grupos" recuento={recuento}>
        <SelectParcela
          parcelas={parcelas.data ?? []}
          value={filtros.parcelaId}
          onChange={(valor) => setFiltro('parcelaId', valor)}
          labelOculto
        />
      </DatosToolbar>
      <ScopeChips chips={chips} />
      {grupos.isPending ? (
        <Cargando label="Cargando grupos…" />
      ) : grupos.data.length === 0 && hayFiltro ? (
        <VacioConFiltros mensaje="Ningún grupo coincide con los filtros" onLimpiar={limpiar} />
      ) : (
        <Table
          columns={COLUMNAS}
          rows={grupos.data}
          getRowKey={(grupo) => grupo.id}
          onRowClick={verArboles}
          emptyMessage="Sin grupos para mostrar"
        />
      )}
    </>
  );
}
