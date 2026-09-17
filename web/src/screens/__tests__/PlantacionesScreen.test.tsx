import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { estadoMock, prepararSesionAdmin } from '../../test/supabaseMock';
import { configurarPlantacionesMock } from '../../test/plantacionesMock';
import { enMain, renderRutasEn } from '../../test/renderConRutas';

/** Aserciones de contenido de fila acotadas a la tabla: evita chocar con las
 *  <option> del Select de temporada, que repiten esos textos. */
function enTabla() {
  return within(screen.getByRole('table'));
}

/** Espera a que la tabla cargue: la fecha "Creada" solo existe en las celdas. */
function esperarTablaCargada() {
  return screen.findByText('15 ene 2025');
}

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(prepararSesionAdmin);

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
  expect(tabla.getByText('15 ene 2025')).toBeInTheDocument();
  // "Oculta" aparece una sola vez: solo la plantación con visible_in_app=false.
  expect(tabla.getAllByText('Oculta')).toHaveLength(1);
});

test('la cabecera resume plantaciones, temporadas y árboles del listado', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  expect(enMain().getByRole('heading', { name: 'Plantaciones' })).toBeInTheDocument();
  // 2 plantaciones, 2 temporadas distintas, 120 + 80 = 200 árboles.
  expect(
    enMain().getByText('2 plantaciones · 2 temporadas · 200 árboles registrados'),
  ).toBeInTheDocument();
});

test('el segmentado de estado filtra las filas de la tabla', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  await usuario.click(enMain().getByRole('radio', { name: 'Activas' }));
  expect(enTabla().getByText('Mendoza')).toBeInTheDocument();
  expect(enTabla().queryByText('Salta')).not.toBeInTheDocument();

  await usuario.click(enMain().getByRole('radio', { name: 'Finalizadas' }));
  expect(enTabla().queryByText('Mendoza')).not.toBeInTheDocument();
  expect(enTabla().getByText('Salta')).toBeInTheDocument();

  await usuario.click(enMain().getByRole('radio', { name: 'Todas' }));
  expect(enTabla().getByText('Mendoza')).toBeInTheDocument();
  expect(enTabla().getByText('Salta')).toBeInTheDocument();
});

test('la búsqueda filtra por lugar y actualiza el recuento', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  await usuario.type(enMain().getByPlaceholderText(/Buscar por lugar/i), 'salta');

  await waitFor(() => expect(enTabla().queryByText('Mendoza')).not.toBeInTheDocument());
  expect(enTabla().getByText('Salta')).toBeInTheDocument();
  // El pie de la card sigue al subconjunto filtrado; la cabecera, al total.
  expect(enMain().getByText('1 plantación · clic en una fila abre el detalle')).toBeInTheDocument();
  expect(
    enMain().getByText('2 plantaciones · 2 temporadas · 200 árboles registrados'),
  ).toBeInTheDocument();
});

test('el Select de temporada acota a un período', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  await usuario.selectOptions(enMain().getByLabelText('Filtrar por temporada'), '2024-2025');
  expect(enTabla().getByText('Salta')).toBeInTheDocument();
  expect(enTabla().queryByText('Mendoza')).not.toBeInTheDocument();
});

test('el orden por lugar reordena las filas', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  // Por árboles (default): Salta 80 va después de Mendoza 120.
  const porArboles = enTabla()
    .getAllByRole('row')
    .slice(1)
    .map((fila) => within(fila).getByText(/Mendoza|Salta/).textContent);
  expect(porArboles).toEqual(['Mendoza', 'Salta']);

  await usuario.selectOptions(enMain().getByLabelText('Ordenar plantaciones'), 'Orden: creada ↓');
  const porCreada = enTabla()
    .getAllByRole('row')
    .slice(1)
    .map((fila) => within(fila).getByText(/Mendoza|Salta/).textContent);
  expect(porCreada).toEqual(['Mendoza', 'Salta']);
});

test('una búsqueda sin coincidencias muestra el vacío del listado', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await esperarTablaCargada();

  await usuario.type(enMain().getByPlaceholderText(/Buscar por lugar/i), 'zzz-no-existe');

  expect(
    await enMain().findByText('Ninguna plantación coincide con los filtros'),
  ).toBeInTheDocument();
  expect(enMain().queryByText('Mendoza')).not.toBeInTheDocument();
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
