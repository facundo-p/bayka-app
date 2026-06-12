import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { configurarPlantacionesMock } from '../../test/plantacionesMock';
import { renderRutasEn } from '../../test/renderConRutas';

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

  expect(await screen.findByText('Mendoza')).toBeInTheDocument();
  expect(screen.getByText('Salta')).toBeInTheDocument();
  expect(screen.getByText('Activa')).toBeInTheDocument();
  expect(screen.getByText('Finalizada')).toBeInTheDocument();
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByText('15/01/2025')).toBeInTheDocument();
  // "Oculta" aparece una sola vez: solo la plantación con visible_in_app=false.
  expect(screen.getAllByText('Oculta')).toHaveLength(1);
});

test('los chips filtran por estado', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');
  await screen.findByText('Mendoza');

  await usuario.click(screen.getByRole('button', { name: 'Activas' }));
  expect(screen.getByText('Mendoza')).toBeInTheDocument();
  expect(screen.queryByText('Salta')).not.toBeInTheDocument();

  await usuario.click(screen.getByRole('button', { name: 'Finalizadas' }));
  expect(screen.queryByText('Mendoza')).not.toBeInTheDocument();
  expect(screen.getByText('Salta')).toBeInTheDocument();

  await usuario.click(screen.getByRole('button', { name: 'Todas' }));
  expect(screen.getByText('Mendoza')).toBeInTheDocument();
  expect(screen.getByText('Salta')).toBeInTheDocument();
});

test('clic en una fila navega al detalle de la plantación', async () => {
  configurarPlantacionesMock(FILAS, STATS);
  const usuario = userEvent.setup();
  renderRutasEn('/plantaciones');

  await usuario.click(await screen.findByText('Mendoza'));
  expect(
    await screen.findByRole('heading', { name: 'Detalle de plantación' }),
  ).toBeInTheDocument();
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
