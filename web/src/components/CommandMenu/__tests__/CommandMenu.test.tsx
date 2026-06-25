import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_SUPERADMIN, estadoMock, resetEstadoMock } from '../../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../../test/queryBuilderMock';
import { renderRutasEn } from '../../../test/renderConRutas';

vi.mock('../../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const FILA_PLANTACION = {
  id: 'plant-1',
  lugar: 'La Maluka',
  periodo: 'Otoño 2026',
  estado: 'activa',
  created_at: '2026-04-01T00:00:00Z',
  visible_in_app: true,
};

const FILA_ESPECIE = {
  id: 'sp-1',
  codigo: 'QB',
  nombre: 'Quebracho',
  nombre_cientifico: 'Schinopsis balansae',
};

const FILA_ARBOL = {
  id: 'tree-1',
  sub_id: 'PAL23ANC12',
  species: { nombre: 'Quebracho' },
  groups: { plantation_id: 'plant-1', codigo: 'L1' },
};

/** El detalle filtra por id con maybeSingle → devolver la fila única. */
function resolverPlantations(consulta: ConsultaCapturada): RespuestaMock {
  const porId = consulta.filtros.find(
    (filtro) => filtro.metodo === 'eq' && filtro.columna === 'id',
  );
  if (porId) return { data: porId.valor === FILA_PLANTACION.id ? FILA_PLANTACION : null };
  return { data: [FILA_PLANTACION], count: 1 };
}

/** Resolver del shell: lista de plantaciones + búsquedas por tabla. */
function responder(consulta: ConsultaCapturada): RespuestaMock {
  switch (consulta.tabla) {
    case 'plantations':
      return resolverPlantations(consulta);
    case 'species':
      return { data: [FILA_ESPECIE] };
    case 'trees':
      return { data: [FILA_ARBOL], count: 1 };
    case 'profiles':
      return { data: [], count: 0 };
    default:
      return { data: [], count: 0 };
  }
}

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_SUPERADMIN;
  estadoMock.resolverConsulta = responder;
  window.localStorage.clear();
});

/** Abre la paleta con ⌘K y espera el dialog. */
async function abrirPaleta() {
  renderRutasEn('/plantaciones');
  await screen.findAllByText('La Maluka');
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  return screen.findByRole('dialog', { name: 'Buscar' });
}

test('⌘K abre la paleta con foco en el input', async () => {
  const dialog = await abrirPaleta();
  expect(within(dialog).getByPlaceholderText(/Buscar plantaciones/)).toHaveFocus();
});

test('el click en el trigger del sidebar también abre la paleta', async () => {
  renderRutasEn('/plantaciones');
  const usuario = userEvent.setup();
  await screen.findAllByText('La Maluka');
  await usuario.click(screen.getByRole('button', { name: /Buscar/ }));
  expect(await screen.findByRole('dialog', { name: 'Buscar' })).toBeInTheDocument();
});

test('escribir devuelve resultados agrupados por tipo', async () => {
  const dialog = await abrirPaleta();
  const usuario = userEvent.setup();
  await usuario.type(within(dialog).getByPlaceholderText(/Buscar plantaciones/), 'PAL23');

  await within(dialog).findByText('PAL23ANC12');
  expect(within(dialog).getByText('Árboles')).toBeInTheDocument();
  const arbol = within(dialog).getByRole('option', { name: /PAL23ANC12/ });
  expect(arbol).toBeInTheDocument();
});

test('estado vacío muestra el chip de scope y sugerencias dentro de la plantación', async () => {
  renderRutasEn('/plantaciones/plant-1');
  await screen.findByRole('heading', { name: 'La Maluka' });
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  const dialog = await screen.findByRole('dialog', { name: 'Buscar' });

  expect(within(dialog).getByRole('button', { name: /en La Maluka/ })).toBeInTheDocument();
  expect(within(dialog).getByText('Sugerencias')).toBeInTheDocument();
});

test('flecha abajo + Enter navega al resultado resaltado', async () => {
  const dialog = await abrirPaleta();
  const usuario = userEvent.setup();
  const input = within(dialog).getByPlaceholderText(/Buscar plantaciones/);
  await usuario.type(input, 'Maluka');

  // El primer resultado tras la acción es la plantación; lo resaltamos y abrimos.
  await within(dialog).findByRole('option', { name: /La Maluka/ });
  fireEvent.keyDown(dialog, { key: 'ArrowDown' });
  fireEvent.keyDown(dialog, { key: 'Enter' });

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument(),
  );
  expect(await screen.findByRole('heading', { name: 'La Maluka' })).toBeInTheDocument();
});

test('Escape cierra la paleta', async () => {
  const dialog = await abrirPaleta();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument(),
  );
});
