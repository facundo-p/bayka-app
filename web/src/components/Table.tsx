import type { MouseEvent, ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { esParcial, estanTodas, type EstadoMaestro } from '../lib/seleccionMaestro';
import { BotonCasilla } from './Casilla';
import { EmptyState } from './EmptyState';
import styles from './Table.module.css';

export interface TableColumn<T> {
  key: string;
  header: string;
  /** Sin render, se muestra el valor de `row[key]` como texto. */
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  /**
   * Secundaria: se cae en pantalla de teléfono, donde no entran todas. El dato
   * sigue estando en el detalle de la fila. La marca vive acá y no en una lista
   * de claves aparte para que no puedan desincronizarse.
   * Quién la aplica: `useColumnasVisibles`.
   */
  fueraEnMovil?: boolean;
  /** Redundante mientras el panel lateral la muestra en grande. */
  fueraConPanel?: boolean;
}

/** Columna de checkboxes al inicio de la tabla, con maestro en el encabezado. */
export interface SeleccionTabla<T> {
  marcada: (row: T) => boolean;
  onAlternar: (row: T) => void;
  maestro: EstadoMaestro;
  onMaestro: () => void;
  /** Nombre accesible del checkbox de cada fila. */
  etiquetaFila: (row: T) => string;
  etiquetaMaestro: string;
}

interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** Clave de la fila abierta en el panel lateral: se resalta. */
  claveSeleccionada?: string | number;
  emptyMessage?: string;
  seleccion?: SeleccionTabla<T>;
}

function alignClass(align?: TableColumn<unknown>['align']): string | undefined {
  return align && align !== 'left' ? styles[align] : undefined;
}

function defaultCell<T>(row: T, key: string): ReactNode {
  const value = (row as Record<string, unknown>)[key];
  return value == null ? '' : String(value);
}

function renderCells<T>(columns: Array<TableColumn<T>>, row: T): ReactNode {
  return columns.map((column) => (
    <td key={column.key} className={alignClass(column.align)}>
      {column.render ? column.render(row) : defaultCell(row, column.key)}
    </td>
  ));
}

function EncabezadoSeleccion<T>({ seleccion }: { seleccion: SeleccionTabla<T> }) {
  return (
    <th className={cx(styles.encabezado, styles.celdaCasilla)}>
      <BotonCasilla
        marcada={estanTodas(seleccion.maestro)}
        parcial={esParcial(seleccion.maestro)}
        aria-label={seleccion.etiquetaMaestro}
        className={styles.botonCasilla}
        onClick={seleccion.onMaestro}
      />
    </th>
  );
}

interface CeldaSeleccionProps<T> {
  seleccion: SeleccionTabla<T>;
  row: T;
  marcada: boolean;
}

/** Todo el alto de la celda es clickeable; el click no llega a la fila (no abre el detalle). */
function CeldaSeleccion<T>({ seleccion, row, marcada }: CeldaSeleccionProps<T>) {
  const alternar = (evento: MouseEvent) => {
    evento.stopPropagation();
    seleccion.onAlternar(row);
  };
  return (
    <td className={styles.celdaCasilla}>
      <BotonCasilla
        marcada={marcada}
        aria-label={seleccion.etiquetaFila(row)}
        className={styles.botonCasilla}
        onClick={alternar}
      />
    </td>
  );
}

export function Table<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  claveSeleccionada,
  emptyMessage = 'Sin datos para mostrar',
  seleccion,
}: TableProps<T>) {
  if (rows.length === 0) return <EmptyState title={emptyMessage} />;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {seleccion && <EncabezadoSeleccion seleccion={seleccion} />}
          {columns.map((column) => (
            <th key={column.key} className={cx(styles.encabezado, alignClass(column.align))}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const clave = getRowKey(row);
          const marcada = seleccion?.marcada(row) ?? false;
          return (
            <tr
              key={clave}
              className={cx(
                onRowClick && styles.clickableRow,
                marcada && styles.filaMarcada,
                claveSeleccionada != null && clave === claveSeleccionada && styles.filaSeleccionada,
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {seleccion && <CeldaSeleccion seleccion={seleccion} row={row} marcada={marcada} />}
              {renderCells(columns, row)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
