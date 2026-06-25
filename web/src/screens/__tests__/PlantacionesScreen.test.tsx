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

  // La celda "Salta" (plantación finalizada) solo existe en la tabla, no en
  // la card del sidebar: sirve para esperar a que la tabla cargue.
  await screen.findByText('Salta');
  const main = enMain();
  expect(main.getByText('Mendoza')).toBeInTheDocument();
  expect(main.getByText('Salta')).toBeInTheDocument();
  expect(main.getByText('Activa')).toBeInTheDocument();
  expect(main.getByText('Finalizada')).toBeInTheDocument();
  expect(main.getByText('120')).toBeInTheDocument();
  expect(main.getByText('15/01/2025')).toBeInTheDocument();
  // "Oculta" aparece una sola vez: solo la plantación con visible_in_app=false.
  expect(main.getAllByText('Oculta')).toHaveLength(1);
});

test('los chips filtran por estado', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await screen.findByText('Salta');

  await usuario.click(screen.getByRole('button', { name: 'Activas' }));
  expect(enMain().getByText('Mendoza')).toBeInTheDocument();
  expect(enMain().queryByText('Salta')).not.toBeInTheDocument();

  await usuario.click(screen.getByRole('button', { name: 'Finalizadas' }));
  expect(enMain().queryByText('Mendoza')).not.toBeInTheDocument();
  expect(enMain().getByText('Salta')).toBeInTheDocument();

  await usuario.click(screen.getByRole('button', { name: 'Todas' }));
  expect(enMain().getByText('Mendoza')).toBeInTheDocument();
  expect(enMain().getByText('Salta')).toBeInTheDocument();
});

test('clic en una fila navega al detalle de la plantación', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');

  await screen.findByText('Salta');
  await usuario.click(enMain().getByText('Mendoza'));
  expect(
    await screen.findByRole('heading', { name: 'Mendoza — 2025-2026' }),
  ).toBeInTheDocument();
});

test('"Nueva plantación" abre el modal de creación', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await screen.findByText('Salta');

  await usuario.click(screen.getByRole('button', { name: 'Nueva plantación' }));
  expect(screen.getByRole('dialog', { name: 'Nueva plantación' })).toBeInTheDocument();
  expect(screen.getByLabelText('Lugar *')).toHaveValue('');
});

test('"Editar" abre el modal precargado sin navegar al detalle', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await screen.findByText('Salta');

  const [editarMendoza] = screen.getAllByRole('button', { name: 'Editar' });
  await usuario.click(editarMendoza);

  // Sigue en el listado (el stopPropagation evitó el click de la fila).
  expect(
    screen.queryByRole('heading', { name: 'Mendoza — 2025-2026' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Editar plantación' })).toBeInTheDocument();
  expect(screen.getByLabelText('Lugar *')).toHaveValue('Mendoza');
  expect(screen.getByLabelText('Período *')).toHaveValue('2025-2026');
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
