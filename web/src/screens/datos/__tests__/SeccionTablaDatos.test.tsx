import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { TableColumn } from '../../../components';
import { SEGMENTO_DATOS } from '../../../lib/rutas';
import { SeccionTablaDatos, type TextosSeccion } from '../SeccionTablaDatos';

type Fila = { id: string };

const TEXTOS: TextosSeccion = {
  unidad: { singular: 'parcela', plural: 'parcelas' },
  cargando: 'Cargando parcelas…',
  error: 'No se pudieron cargar las parcelas.',
  pie: 'Clic en una fila abre sus grupos',
  vacio: 'Sin parcelas',
};

const COLUMNAS: Array<TableColumn<Fila>> = [{ key: 'id', header: 'Id' }];

function filas(cantidad: number): Fila[] {
  return Array.from({ length: cantidad }, (_, i) => ({ id: `f${i}` }));
}

test.each([
  [0, '0 parcelas'],
  [1, '1 parcela'],
  [2, '2 parcelas'],
  [1000, '1.000 parcelas'],
])('el recuento de la toolbar concuerda con %i filas: "%s"', (cantidad, texto) => {
  render(
    <MemoryRouter>
      <SeccionTablaDatos
        segmento={SEGMENTO_DATOS.parcelas}
        consultas={[]}
        filas={filas(cantidad)}
        textos={TEXTOS}
        columnas={COLUMNAS}
        onRowClick={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(screen.getByText(texto)).toBeInTheDocument();
});
