import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import styles from './Table.module.css';

export interface TableColumn<T> {
  key: string;
  header: string;
  /** Sin render, se muestra el valor de `row[key]` como texto. */
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
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

export function Table<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = 'Sin datos para mostrar',
}: TableProps<T>) {
  if (rows.length === 0) return <EmptyState title={emptyMessage} />;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={alignClass(column.align)}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={getRowKey(row)}
            className={onRowClick ? styles.clickableRow : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {renderCells(columns, row)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
