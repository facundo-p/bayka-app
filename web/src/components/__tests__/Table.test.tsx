import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { columnaChevron } from '../columnaChevron';
import { Table, type TableColumn } from '../Table';

interface Fila {
  id: number;
  nombre: string;
  arboles: number;
}

const columns: Array<TableColumn<Fila>> = [
  { key: 'nombre', header: 'Nombre' },
  { key: 'arboles', header: 'Árboles', render: (row) => `${row.arboles} árboles` },
];

const rows: Fila[] = [{ id: 1, nombre: 'Lote Norte', arboles: 12 }];

test('renderiza headers, celdas por defecto y celdas con render', () => {
  const onRowClick = vi.fn();
  render(
    <Table columns={columns} rows={rows} getRowKey={(row) => row.id} onRowClick={onRowClick} />,
  );
  expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
  expect(screen.getByText('Lote Norte')).toBeInTheDocument();
  expect(screen.getByText('12 árboles')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Lote Norte'));
  expect(onRowClick).toHaveBeenCalledWith(rows[0]);
});

test('columnaChevron: última columna sin encabezado, decorativa y fuera en el teléfono', () => {
  const chevron = columnaChevron<Fila>();
  expect(chevron).toMatchObject({ header: '', align: 'right', fueraEnMovil: true });

  render(<Table columns={[...columns, chevron]} rows={rows} getRowKey={(row) => row.id} />);
  const celdas = screen.getAllByRole('cell');
  const icono = celdas[celdas.length - 1].querySelector('svg');
  expect(icono).toHaveAttribute('aria-hidden', 'true');
});

test('sin filas delega en EmptyState con el mensaje', () => {
  render(
    <Table
      columns={columns}
      rows={[]}
      getRowKey={(row) => row.id}
      emptyMessage="Sin plantaciones"
    />,
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByText('Sin plantaciones')).toBeInTheDocument();
});
