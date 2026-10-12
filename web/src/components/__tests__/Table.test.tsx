import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const filaDe = (texto: string) => screen.getByText(texto).closest('tr')!;

test('solo las filas clickeables entran al orden del Tab', async () => {
  const usuario = userEvent.setup();
  const { rerender } = render(
    <Table columns={columns} rows={rows} getRowKey={(row) => row.id} onRowClick={vi.fn()} />,
  );
  await usuario.tab();
  expect(filaDe('Lote Norte')).toHaveFocus();

  rerender(<Table columns={columns} rows={rows} getRowKey={(row) => row.id} />);
  expect(filaDe('Lote Norte')).not.toHaveAttribute('tabindex');
});

describe('teclado sobre una fila clickeable', () => {
  function renderClickeable(columnas: Array<TableColumn<Fila>> = columns) {
    const onRowClick = vi.fn();
    render(
      <Table columns={columnas} rows={rows} getRowKey={(row) => row.id} onRowClick={onRowClick} />,
    );
    return onRowClick;
  }

  test.each([
    ['Enter', '{Enter}'],
    ['Espacio', ' '],
  ])('%s abre la fila', async (_tecla, teclas) => {
    const usuario = userEvent.setup();
    const onRowClick = renderClickeable();
    await usuario.tab();
    await usuario.keyboard(teclas);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  test('Espacio no scrollea la página', () => {
    renderClickeable();
    const noPrevenido = fireEvent.keyDown(filaDe('Lote Norte'), { key: ' ' });
    expect(noPrevenido).toBe(false);
  });

  test('otras teclas no abren la fila', () => {
    const onRowClick = renderClickeable();
    fireEvent.keyDown(filaDe('Lote Norte'), { key: 'a' });
    fireEvent.keyDown(filaDe('Lote Norte'), { key: 'Escape' });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  test('Enter y Espacio en un control de adentro de la fila no la abren', () => {
    const conCampo: Array<TableColumn<Fila>> = [
      ...columns,
      { key: 'nota', header: 'Nota', render: (row) => <input aria-label={`Nota ${row.nombre}`} /> },
    ];
    const onRowClick = renderClickeable(conCampo);
    const campo = screen.getByRole('textbox', { name: 'Nota Lote Norte' });
    expect(fireEvent.keyDown(campo, { key: ' ' })).toBe(true);
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onRowClick).not.toHaveBeenCalled();
  });
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

describe('con selección', () => {
  function renderConSeleccion(marcadas: number[] = []) {
    const onRowClick = vi.fn();
    const seleccion = {
      marcada: (row: Fila) => marcadas.includes(row.id),
      onAlternar: vi.fn(),
      maestro: 'parcial' as const,
      onMaestro: vi.fn(),
      etiquetaFila: (row: Fila) => `Seleccionar ${row.nombre}`,
      etiquetaMaestro: 'Seleccionar todas',
    };
    render(
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
        seleccion={seleccion}
      />,
    );
    return { onRowClick, seleccion };
  }

  test('el checkbox de la fila alterna sin disparar el click de la fila', () => {
    const { onRowClick, seleccion } = renderConSeleccion();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Lote Norte' }));
    expect(seleccion.onAlternar).toHaveBeenCalledWith(rows[0]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  test('con teclado, el Tab pasa de la fila a su checkbox y Enter ahí solo alterna', async () => {
    const usuario = userEvent.setup();
    const { onRowClick, seleccion } = renderConSeleccion();
    await usuario.tab();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar todas' })).toHaveFocus();
    await usuario.tab();
    expect(filaDe('Lote Norte')).toHaveFocus();

    await usuario.tab();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Lote Norte' })).toHaveFocus();
    await usuario.keyboard('{Enter}');
    expect(seleccion.onAlternar).toHaveBeenCalledWith(rows[0]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  test('el maestro refleja su estado y avisa el click', () => {
    const { seleccion } = renderConSeleccion([1]);
    const maestro = screen.getByRole('checkbox', { name: 'Seleccionar todas' });
    expect(maestro).toHaveAttribute('aria-checked', 'mixed');
    fireEvent.click(maestro);
    expect(seleccion.onMaestro).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Lote Norte' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
