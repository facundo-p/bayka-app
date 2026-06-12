import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  crearPlantacion,
  editarPlantacion,
  existePlantacion,
} from '../../repositories/plantationRepository';
import { PlantacionFormModal, type PlantacionEditable } from '../PlantacionFormModal';

vi.mock('../../repositories/plantationRepository', () => ({
  crearPlantacion: vi.fn(),
  editarPlantacion: vi.fn(),
  existePlantacion: vi.fn(),
}));

const PERFIL = { id: 'user-1', nombre: 'Ana', rol: 'admin', organizacionId: 'org-1' };

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ estado: 'autenticado', perfil: PERFIL }),
}));

/** Reset completo + comportamiento feliz por defecto; cada test pisa lo suyo. */
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crearPlantacion).mockResolvedValue('plant-nuevo');
  vi.mocked(editarPlantacion).mockResolvedValue(undefined);
  vi.mocked(existePlantacion).mockResolvedValue(false);
});

function renderModal(plantacion: PlantacionEditable | null = null) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PlantacionFormModal plantacion={plantacion} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

async function completarObligatorios(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Lugar *'), 'Mendoza');
  await usuario.type(screen.getByLabelText('Período *'), '2025-2026');
}

test('crear feliz: valida, llama al repository con el perfil y cierra', async () => {
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await completarObligatorios(usuario);
  await usuario.type(screen.getByLabelText('Superficie (ha)'), '12.5');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(crearPlantacion)).toHaveBeenCalledWith(
    expect.objectContaining({ lugar: 'Mendoza', periodo: '2025-2026', superficieHa: 12.5 }),
    PERFIL,
  );
});

test('con campos inválidos muestra errores por campo y no guarda', async () => {
  const usuario = userEvent.setup();
  renderModal();

  await usuario.type(screen.getByLabelText('Ubicación: latitud'), '95');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByText('El lugar es obligatorio')).toBeInTheDocument();
  expect(screen.getByText('El período es obligatorio')).toBeInTheDocument();
  expect(screen.getByText('La latitud debe ser un número entre -90 y 90')).toBeInTheDocument();
  expect(screen.getByText('Completá la longitud: va junto con la latitud')).toBeInTheDocument();
  expect(vi.mocked(crearPlantacion)).not.toHaveBeenCalled();
});

test('duplicado: advierte sin bloquear y crea recién con "Crear igualmente"', async () => {
  vi.mocked(existePlantacion).mockResolvedValue(true);
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await completarObligatorios(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(
    await screen.findByText('Ya existe una plantación con ese lugar y período.'),
  ).toBeInTheDocument();
  expect(vi.mocked(crearPlantacion)).not.toHaveBeenCalled();

  await usuario.click(screen.getByRole('button', { name: 'Crear igualmente' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(crearPlantacion)).toHaveBeenCalledTimes(1);
});

test('editar: precarga los valores (nulls de la 024 → vacíos) y llama a editarPlantacion', async () => {
  const usuario = userEvent.setup();
  const onClose = renderModal({
    id: 'plant-1',
    lugar: 'Salta',
    periodo: '2024-2025',
    descripcion: 'Finca sur',
    fechaInicio: null,
    superficieHa: 8,
    ubicacionLat: null,
    ubicacionLng: null,
    objetivoArboles: null,
  });

  expect(screen.getByLabelText('Lugar *')).toHaveValue('Salta');
  expect(screen.getByLabelText('Descripción')).toHaveValue('Finca sur');
  expect(screen.getByLabelText('Superficie (ha)')).toHaveValue(8);
  expect(screen.getByLabelText('Objetivo de árboles')).toHaveValue(null);

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(editarPlantacion)).toHaveBeenCalledWith(
    'plant-1',
    expect.objectContaining({ lugar: 'Salta', superficieHa: 8 }),
  );
  expect(vi.mocked(existePlantacion)).toHaveBeenCalledWith('Salta', '2024-2025', 'plant-1');
});

test('error de red: muestra mensaje claro, conserva lo tipeado y no cierra', async () => {
  vi.mocked(crearPlantacion).mockRejectedValue(new Error('network'));
  const usuario = userEvent.setup();
  const onClose = renderModal();

  await completarObligatorios(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo guardar la plantación. Revisá tu conexión y probá de nuevo.',
  );
  expect(screen.getByLabelText('Lugar *')).toHaveValue('Mendoza');
  expect(onClose).not.toHaveBeenCalled();
});
