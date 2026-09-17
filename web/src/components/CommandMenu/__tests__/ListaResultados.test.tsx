import { render, screen } from '@testing-library/react';
import { ListaResultados } from '../ListaResultados';
import type { ListboxPaleta } from '../useListboxPaleta';
import type { AvisoVacio } from '../useSeccionesCommandMenu';

vi.mock('../../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const LISTBOX = {
  propsLista: () => ({ role: 'listbox' }),
  propsOpcion: vi.fn(),
  elegir: vi.fn(),
} as unknown as ListboxPaleta;

function renderAviso(avisoVacio: AvisoVacio, texto = '') {
  render(
    <ListaResultados
      contenido={{ secciones: [], itemsPlanos: [], avisoVacio }}
      texto={texto}
      listbox={LISTBOX}
    />,
  );
}

test('cargando: el spinner de carga y ningún mensaje', () => {
  renderAviso('cargando');

  expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  expect(screen.queryByText(/Sin resultados/)).not.toBeInTheDocument();
});

test('nada que sugerir: un mensaje neutro, sin comillas vacías', () => {
  renderAviso('nada-que-sugerir');

  expect(
    screen.getByText('Todavía no hay recientes ni plantaciones para sugerir.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/“”/)).not.toBeInTheDocument();
});

test('sin resultados: repite el texto buscado', () => {
  renderAviso('sin-resultados', 'x');

  expect(screen.getByText('Sin resultados para “x”.')).toBeInTheDocument();
});
