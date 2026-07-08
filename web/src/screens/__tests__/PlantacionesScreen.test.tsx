import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { configurarPlantacionesMock } from '../../test/plantacionesMock';
import { renderRutasEn } from '../../test/renderConRutas';

/** El contenido de la pantalla vive en <main>; el sidebar (con la card de
 *  temporada activa, que también muestra el lugar de una plantación) queda
 *  fuera. Acotamos las aserciones de la tabla a <main> para no chocar con él. */
function enMain() {
  return within(screen.getByRole('main'));
}

/** Aserciones de contenido de fila acotadas a la tabla: evita chocar con las
 *  <option> de los Selects de filtro (Lugar/Período), que repiten esos textos. */
function enTabla() {
  return within(screen.getByRole('table'));
}

/** Espera a que la tabla cargue: la fecha "Creada" solo existe en las celdas. */
function esperarTablaCargada() {
  return screen.findByText('15/01/2025');
}

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
});

const FILAS = [
  {
    id: 'plant-1',
    lugar: 'Mendoza',
    periodo: '2025-2026',
    estado: 'activa',
    created_at: '2026-06-12T12:00:00Z',
    visible_in_app: true,
  },
  {
    id: 'plant-2',
    lugar: 'Salta',
    periodo: '2024-2025',
    estado: 'finalizada',
    created_at: '2025-01-15T12:00:00Z',
    visible_in_app: false,
  },
];

const STATS = {
  'plant-1': { arboles: 120, parcelas: 3, usuarios: 2 },
  'plant-2': { arboles: 80, parcelas: 1, usuarios: 4 },
};

test('renderiza las filas con stats, estado, visibilidad y fecha', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  renderRutasEn('/plantaciones');

  await esperarTablaCargada();
  const tabla = enTabla();
  expect(tabla.getByText('Mendoza')).toBeInTheDocument();
  expect(tabla.getByText('Salta')).toBeInTheDocument();
  expect(tabla.getByText('Activa')).toBeInTheDocument();
  expect(tabla.getByText('Finalizada')).toBeInTheDocument();
  expect(tabla.getByText('120')).toBeInTheDocument();
  expect(tabla.getByText('15/01/2025')).toBeInTheDocument();
  // "Oculta" aparece una sola vez: solo la plantación con visible_in_app=false.
  expect(tabla.getAllByText('Oculta')).toHaveLength(1);
});

test('el subtítulo cuenta plantaciones, temporadas distintas y árboles', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  // 2 plantaciones, 2 períodos distintos, 120 + 80 = 200 árboles (sin prefijo:
  // no hay filtros activos).
  expect(
    enMain().getByText('2 plantaciones · 2 temporadas · 200 árboles registrados'),
  ).toBeInTheDocument();
});

test('el Select de estado filtra las filas de la tabla', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  await usuario.selectOptions(enMain().getByLabelText('Estado'), 'activa');
  expect(enTabla().getByText('Mendoza')).toBeInTheDocument();
  expect(enTabla().queryByText('Salta')).not.toBeInTheDocument();

  await usuario.selectOptions(enMain().getByLabelText('Estado'), 'finalizada');
  expect(enTabla().queryByText('Mendoza')).not.toBeInTheDocument();
  expect(enTabla().getByText('Salta')).toBeInTheDocument();

  await usuario.selectOptions(enMain().getByLabelText('Estado'), '');
  expect(enTabla().getByText('Mendoza')).toBeInTheDocument();
  expect(enTabla().getByText('Salta')).toBeInTheDocument();
});

test('combina lugar y recalcula el subtítulo con "Mostrando:"', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  await usuario.selectOptions(enMain().getByLabelText('Lugar'), 'Mendoza');
  expect(enTabla().getByText('Mendoza')).toBeInTheDocument();
  expect(enTabla().queryByText('Salta')).not.toBeInTheDocument();
  // 1 plantación (Mendoza), 1 temporada, 120 árboles, con prefijo de selección.
  expect(
    enMain().getByText('Mostrando: 1 plantaciones · 1 temporadas · 120 árboles registrados'),
  ).toBeInTheDocument();
});

test('sin coincidencias muestra el estado vacío y permite limpiar filtros', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  // Salta solo tiene una plantación finalizada: activa + Salta = 0 resultados.
  await usuario.selectOptions(enMain().getByLabelText('Lugar'), 'Salta');
  await usuario.selectOptions(enMain().getByLabelText('Estado'), 'activa');
  expect(enMain().getByText('Sin resultados')).toBeInTheDocument();
  expect(
    enMain().getByText('Mostrando: 0 plantaciones · 0 temporadas · 0 árboles registrados'),
  ).toBeInTheDocument();

  await usuario.click(enMain().getByRole('button', { name: 'Limpiar filtros' }));
  expect(enTabla().getByText('Mendoza')).toBeInTheDocument();
  expect(enTabla().getByText('Salta')).toBeInTheDocument();
});

test('clic en una fila navega al detalle de la plantación', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');

  await esperarTablaCargada();
  await usuario.click(enTabla().getByText('Mendoza'));
  expect(await screen.findByRole('heading', { name: 'Mendoza' })).toBeInTheDocument();
});

test('"Nueva plantación" abre el modal de creación', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  await usuario.click(screen.getByRole('button', { name: 'Nueva plantación' }));
  expect(screen.getByRole('dialog', { name: 'Nueva plantación' })).toBeInTheDocument();
  expect(screen.getByLabelText('Lugar *')).toHaveValue('');
});

test('sin plantaciones muestra el estado vacío', async () => {
  configurarPlantacionesMock([]);
  renderRutasEn('/plantaciones');
  expect(await screen.findByText('Sin plantaciones')).toBeInTheDocument();
});

test('ante un error muestra el mensaje con botón de reintento', async () => {
  estadoMock.resolverConsulta = () => {
    throw new Error('falló la red');
  };
  renderRutasEn('/plantaciones');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudieron cargar las plantaciones.',
  );
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
});
