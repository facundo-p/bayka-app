import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_SUPERADMIN, estadoMock, prepararSesion } from '../../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../../test/queryBuilderMock';
import { renderRutasEn } from '../../../test/renderConRutas';

vi.mock('../../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../../test/supabaseMock');
  return { supabase: supabaseMock };
});

// El detalle de plantación monta el dashboard, y Leaflet no anda en jsdom.
vi.mock('../../PlantationMap', () => ({
  PlantationMap: () => <div>Mapa de la plantación</div>,
}));

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

/** El mock responde esta fila a TODA consulta de `trees`, incluida la del
 *  dashboard de la plantación: lleva también sus columnas. */
const FILA_ARBOL = {
  id: 'tree-1',
  sub_id: 'PAL23ANC12',
  species_id: 'sp-1',
  species: { nombre: 'Quebracho' },
  foto_url: null,
  latitude: null,
  created_at: '2026-04-02T00:00:00Z',
  group_id: 'gr-1',
  groups: { plantation_id: 'plant-1', codigo: 'L1', parcela_id: null },
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
  prepararSesion(PERFIL_SUPERADMIN);
  estadoMock.resolverConsulta = responder;
  window.localStorage.clear();
});

/** Ids de las opciones una vez que la lista dejó de crecer.
 *
 *  La búsqueda entra con debounce y en tandas, y `useNavegacionTeclado` resetea
 *  el resaltado cada vez que cambia la cantidad de ítems: si la flecha se manda
 *  antes de que la lista se aquiete, el resaltado vuelve a 0 y el cambio se
 *  pierde. Además exige al menos dos opciones, porque con una sola la flecha da
 *  la vuelta sobre sí misma y el índice nunca cambia. */
async function esperarOpcionesEstables(dialog: HTMLElement): Promise<string[]> {
  let previas = -1;
  await waitFor(() => {
    const cantidad = within(dialog).getAllByRole('option').length;
    const estable = cantidad > 1 && cantidad === previas;
    previas = cantidad;
    expect(estable).toBe(true);
  });
  return within(dialog)
    .getAllByRole('option')
    .map((opcion) => opcion.id);
}

/** Abre la paleta con ⌘K y espera el dialog. */
async function abrirPaleta() {
  renderRutasEn('/plantaciones');
  await screen.findAllByText('La Maluka');
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  return screen.findByRole('dialog', { name: 'Buscar' });
}

/** Dentro de una plantación la paleta tiene scope y suma "Ir a Configuración…". */
async function abrirPaletaEnPlantacion() {
  renderRutasEn('/plantaciones/plant-1');
  await screen.findByRole('heading', { name: 'La Maluka' });
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
  const dialog = await abrirPaletaEnPlantacion();

  expect(within(dialog).getByRole('button', { name: /en La Maluka/ })).toBeInTheDocument();
  expect(within(dialog).getByText('Sugerencias')).toBeInTheDocument();
});

/** Encabezados del estado vacío que pinta la lista, en orden. */
function encabezadosVacio(dialog: HTMLElement): string[] {
  const lista = within(dialog).getByRole('listbox');
  return within(lista)
    .queryAllByText(/^(Recientes|Sugerencias)$/)
    .map((nodo) => nodo.textContent ?? '');
}

test('sin texto ni recientes: un único encabezado "Sugerencias"', async () => {
  const dialog = await abrirPaleta();

  await within(dialog).findByRole('option', { name: /La Maluka/ });
  expect(encabezadosVacio(dialog)).toEqual(['Sugerencias']);
});

test('sin texto y con recientes: un único encabezado "Recientes"', async () => {
  window.localStorage.setItem(
    'bayka.command-menu.recientes',
    JSON.stringify([{ tipo: 'arbol', id: 'tree-1', titulo: 'PAL23ANC12', to: '/arboles/tree-1' }]),
  );
  const dialog = await abrirPaleta();

  await within(dialog).findByRole('option', { name: /PAL23ANC12/ });
  expect(encabezadosVacio(dialog)).toEqual(['Recientes']);
});

test('sin texto, recientes ni plantaciones: mensaje neutro, sin encabezados ni comillas vacías', async () => {
  estadoMock.resolverConsulta = (consulta) =>
    consulta.tabla === 'plantations' ? { data: [], count: 0 } : responder(consulta);
  renderRutasEn('/plantaciones');
  await screen.findByRole('button', { name: /Buscar/ });
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  const dialog = await screen.findByRole('dialog', { name: 'Buscar' });

  expect(
    await within(dialog).findByText('Todavía no hay recientes ni plantaciones para sugerir.'),
  ).toBeInTheDocument();
  expect(encabezadosVacio(dialog)).toEqual([]);
  expect(within(dialog).queryByText(/Sin resultados/)).not.toBeInTheDocument();
});

test('con texto y sin resultados: «Sin resultados para “…”» con lo que se buscó', async () => {
  estadoMock.resolverConsulta = (consulta) =>
    consulta.tabla === 'trees' ? { data: [], count: 0 } : responder(consulta);
  const dialog = await abrirPaleta();
  const usuario = userEvent.setup();
  await usuario.type(within(dialog).getByPlaceholderText(/Buscar plantaciones/), 'zzz');

  expect(await within(dialog).findByText('Sin resultados para “zzz”.')).toBeInTheDocument();
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

test('aria-activedescendant del input sigue a la opción resaltada', async () => {
  const dialog = await abrirPaleta();
  const usuario = userEvent.setup();
  const input = within(dialog).getByPlaceholderText(/Buscar plantaciones/);
  await usuario.type(input, 'Maluka');
  await within(dialog).findByRole('option', { name: /La Maluka/ });
  const ids = await esperarOpcionesEstables(dialog);

  // aria-controls apunta al listbox; activedescendant a la opción resaltada.
  const listbox = within(dialog).getByRole('listbox');
  expect(input).toHaveAttribute('aria-controls', listbox.id);
  expect(input).toHaveAttribute('aria-autocomplete', 'list');
  expect(input).toHaveAttribute('aria-activedescendant', ids[0]);
  expect(document.getElementById(ids[0])).toHaveAttribute('aria-selected', 'true');

  fireEvent.keyDown(dialog, { key: 'ArrowDown' });
  await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', ids[1]));
  expect(document.getElementById(ids[1])).toHaveAttribute('aria-selected', 'true');
});

test('Home y End resaltan la primera y la última opción; ArrowUp da la vuelta', async () => {
  const dialog = await abrirPaleta();
  const usuario = userEvent.setup();
  const input = within(dialog).getByPlaceholderText(/Buscar plantaciones/);
  await usuario.type(input, 'Maluka');
  await within(dialog).findByRole('option', { name: /La Maluka/ });
  const ids = await esperarOpcionesEstables(dialog);
  const ultima = ids[ids.length - 1];

  fireEvent.keyDown(dialog, { key: 'End' });
  await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', ultima));
  fireEvent.keyDown(dialog, { key: 'Home' });
  await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', ids[0]));
  fireEvent.keyDown(dialog, { key: 'ArrowUp' });
  await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', ultima));
});

test('las acciones ignoran acentos: "configuracion" encuentra "Ir a Configuración…"', async () => {
  const dialog = await abrirPaletaEnPlantacion();
  const usuario = userEvent.setup();

  await usuario.type(within(dialog).getByPlaceholderText(/Buscar plantaciones/), 'configuracion');

  expect(
    await within(dialog).findByRole('option', { name: /Ir a Configuración…/ }),
  ).toBeInTheDocument();
});

test('Escape cierra la paleta', async () => {
  const dialog = await abrirPaleta();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument(),
  );
});

test('el click afuera cierra la paleta y devuelve el foco al trigger; adentro no', async () => {
  renderRutasEn('/plantaciones');
  const usuario = userEvent.setup();
  await screen.findAllByText('La Maluka');
  const trigger = screen.getByRole('button', { name: /Buscar/ });
  await usuario.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Buscar' });

  await usuario.click(within(dialog).getByPlaceholderText(/Buscar plantaciones/));
  expect(dialog).toBeInTheDocument();

  await usuario.click(dialog.parentElement!);
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});

test('elegir un resultado lo guarda en recientes, y al reabrir reemplazan a las sugerencias', async () => {
  const dialog = await abrirPaleta();
  const usuario = userEvent.setup();
  await usuario.type(within(dialog).getByPlaceholderText(/Buscar plantaciones/), 'Maluka');
  await usuario.click(await within(dialog).findByRole('option', { name: /La Maluka/ }));

  await screen.findByRole('heading', { name: 'La Maluka' });
  const guardados = JSON.parse(window.localStorage.getItem('bayka.command-menu.recientes')!);
  expect(guardados).toEqual([expect.objectContaining({ titulo: 'La Maluka' })]);

  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  const reabierto = await screen.findByRole('dialog', { name: 'Buscar' });
  expect(within(reabierto).getByRole('option', { name: /La Maluka/ })).toBeInTheDocument();
  expect(within(reabierto).queryByText('Sugerencias')).not.toBeInTheDocument();
});

test('elegir una acción navega pero no la guarda en recientes', async () => {
  const dialog = await abrirPaleta();
  const usuario = userEvent.setup();
  await usuario.type(within(dialog).getByPlaceholderText(/Buscar plantaciones/), 'Ir a Especies');
  await usuario.click(await within(dialog).findByRole('option', { name: /Ir a Especies/ }));

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument(),
  );
  expect(window.localStorage.getItem('bayka.command-menu.recientes')).toBeNull();
});

test('quitar el chip de scope saca "Ir a Configuración…" de las acciones', async () => {
  const dialog = await abrirPaletaEnPlantacion();
  const usuario = userEvent.setup();

  await usuario.click(within(dialog).getByRole('button', { name: /en La Maluka/ }));
  expect(within(dialog).queryByRole('button', { name: /en La Maluka/ })).not.toBeInTheDocument();

  await usuario.type(within(dialog).getByPlaceholderText(/Buscar plantaciones/), 'configuracion');
  expect(
    within(dialog).queryByRole('option', { name: /Ir a Configuración…/ }),
  ).not.toBeInTheDocument();
});
