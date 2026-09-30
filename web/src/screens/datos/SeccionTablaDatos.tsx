import type { ReactNode } from 'react';
import { Cargando, CardTabla, ErrorConReintento, Table, type TableColumn } from '../../components';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { algunaConError, reintentarTodas, type EstadoConsulta } from '../../lib/consultas';
import { pluralizar, type Sustantivo } from '../../lib/formato';
import type { SegmentoDatos } from '../../lib/rutas';
import { DatosToolbar } from './DatosToolbar';
import { VacioConFiltros } from './VacioConFiltros';

export interface TextosSeccion {
  /** Qué cuenta el recuento de la toolbar. */
  unidad: Sustantivo;
  cargando: string;
  error: string;
  /** Qué hace clickear una fila. */
  pie: string;
  vacio: string;
  /** Tabla vacía por los filtros, ej. "Ningún grupo coincide con los filtros". */
  vacioConFiltros: string;
}

/** Filtros puestos en la sección: la toolbar los cuenta y la tabla vacía ofrece limpiarlos. */
export interface FiltrosSeccion {
  activos: number;
  onLimpiar: () => void;
}

interface TablaSeccionProps<T> {
  textos: TextosSeccion;
  columnas: Array<TableColumn<T>>;
  onRowClick: (fila: T) => void;
  filtros: FiltrosSeccion;
}

interface SeccionTablaDatosProps<T> extends TablaSeccionProps<T> {
  segmento: SegmentoDatos;
  /** Todas las queries de la sección: si una falla, falla la sección. */
  consultas: EstadoConsulta[];
  filas: T[] | undefined;
  /** Filtros de la sección, en línea dentro de la toolbar. */
  children?: ReactNode;
}

function TablaSeccion<T extends { id: string }>(props: TablaSeccionProps<T> & { filas: T[] }) {
  const { filas, textos, columnas, onRowClick, filtros } = props;
  const visibles = useColumnasVisibles(columnas);
  if (filas.length === 0 && filtros.activos > 0) {
    return <VacioConFiltros mensaje={textos.vacioConFiltros} onLimpiar={filtros.onLimpiar} />;
  }
  return (
    <CardTabla pie={textos.pie}>
      <Table
        columns={visibles}
        rows={filas}
        getRowKey={(fila) => fila.id}
        onRowClick={onRowClick}
        emptyMessage={textos.vacio}
      />
    </CardTabla>
  );
}

/** Toolbar + tabla de una sección de Datos, con sus estados de carga, error y vacío. */
export function SeccionTablaDatos<T extends { id: string }>(props: SeccionTablaDatosProps<T>) {
  const { segmento, consultas, filas, children, ...tabla } = props;
  if (algunaConError(consultas)) {
    return (
      <ErrorConReintento mensaje={tabla.textos.error} onReintentar={reintentarTodas(consultas)} />
    );
  }
  const recuento = filas && pluralizar(filas.length, tabla.textos.unidad);
  const cuerpo = filas ? <TablaSeccion filas={filas} {...tabla} /> : null;
  return (
    <>
      <DatosToolbar
        segmento={segmento}
        recuento={recuento}
        filtrosActivos={tabla.filtros.activos}
        onLimpiar={tabla.filtros.onLimpiar}
      >
        {children}
      </DatosToolbar>
      {cuerpo ?? <Cargando label={tabla.textos.cargando} />}
    </>
  );
}
