import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { activaComoBoton } from '../lib/teclas';
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

interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** Clave de la fila abierta en el panel lateral: se resalta. */
  claveSeleccionada?: string | number;
  emptyMessage?: string;
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

interface FilaTablaProps<T> extends Pick<TableProps<T>, 'columns' | 'onRowClick'> {
  row: T;
  /** Abierta en el panel lateral. */
  abierta: boolean;
}

/**
 * Enter o Espacio abren la fila como un clic, solo si el foco está en la fila:
 * en un botón, link o campo de adentro la tecla es de ese control. Espacio no
 * scrollea la página.
 */
function alTeclearFila(abrir: () => void) {
  return (evento: KeyboardEvent<HTMLTableRowElement>) => {
    if (evento.target !== evento.currentTarget || !activaComoBoton(evento.key)) return;
    evento.preventDefault();
    abrir();
  };
}

/**
 * La fila clickeable entra al orden del Tab y la hoja de detalle le devuelve
 * el foco al cerrar. Sigue siendo una fila de la tabla, sin rol de botón, para
 * que el lector de pantalla lea sus celdas con sus encabezados.
 */
function propsFilaClickeable(abrir: () => void) {
  return { onClick: abrir, onKeyDown: alTeclearFila(abrir), tabIndex: 0 };
}

function FilaTabla<T>({ row, columns, abierta, onRowClick }: FilaTablaProps<T>) {
  return (
    <tr
      className={cx(onRowClick && styles.clickableRow, abierta && styles.filaSeleccionada)}
      {...(onRowClick && propsFilaClickeable(() => onRowClick(row)))}
    >
      {renderCells(columns, row)}
    </tr>
  );
}

function EncabezadoTabla<T>({ columns }: Pick<TableProps<T>, 'columns'>) {
  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column.key} className={cx(styles.encabezado, alignClass(column.align))}>
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Table<T>(props: TableProps<T>) {
  const { rows, getRowKey, claveSeleccionada, emptyMessage = 'Sin datos para mostrar' } = props;
  if (rows.length === 0) return <EmptyState title={emptyMessage} />;
  const { columns, onRowClick } = props;
  return (
    <table className={styles.table}>
      <EncabezadoTabla columns={columns} />
      <tbody>
        {rows.map((row) => {
          const clave = getRowKey(row);
          const abierta = claveSeleccionada != null && clave === claveSeleccionada;
          const fila = { row, columns, abierta, onRowClick };
          return <FilaTabla key={clave} {...fila} />;
        })}
      </tbody>
    </table>
  );
}
