import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  crearPlantacion,
  editarPlantacion,
  existePlantacion,
} from '../../repositories/plantationRepository';
import {
  ConflictoDeEdicionError,
  MENSAJE_CONFLICTO_EDICION,
} from '../../repositories/edicionDePlantacion';
import { PlantacionFormModal, type PlantacionEditable } from '../PlantacionFormModal';

vi.mock('../../repositories/plantationRepository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../repositories/plantationRepository')>()),
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

const SALTA: PlantacionEditable = {
  id: 'plant-1',
  lugar: 'Salta',
  periodo: '2024-2025',
  descripcion: 'Finca sur',
  fechaInicio: null,
  objetivoArboles: null,
};

function renderModal(plantacion: PlantacionEditable | null = null) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <PlantacionFormModal plantacion={plantacion} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, invalidateQueries };
}

async function completarObligatorios(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Lugar *'), 'Mendoza');
  await usuario.type(screen.getByLabelText('Período *'), '2025-2026');
}

test('crear feliz: valida, llama al repository con el perfil y cierra', async () => {
  const usuario = userEvent.setup();
  const { onClose } = renderModal();

  await completarObligatorios(usuario);
  await usuario.type(screen.getByLabelText('Objetivo de árboles'), '1000');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(crearPlantacion)).toHaveBeenCalledWith(
    expect.objectContaining({ lugar: 'Mendoza', periodo: '2025-2026', objetivoArboles: 1000 }),
    PERFIL,
  );
});

test('con campos inválidos muestra errores por campo y no guarda', async () => {
  const usuario = userEvent.setup();
  renderModal();

  await usuario.type(screen.getByLabelText('Objetivo de árboles'), '0');
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByText('El lugar es obligatorio')).toBeInTheDocument();
  expect(screen.getByText('El período es obligatorio')).toBeInTheDocument();
  expect(
    screen.getByText('El objetivo debe ser un número entero de al menos 1 árbol'),
  ).toBeInTheDocument();
  expect(vi.mocked(crearPlantacion)).not.toHaveBeenCalled();
});

test('duplicado: advierte sin bloquear y crea recién con "Crear igualmente"', async () => {
  vi.mocked(existePlantacion).mockResolvedValue(true);
  const usuario = userEvent.setup();
  const { onClose } = renderModal();

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
  const { onClose } = renderModal(SALTA);

  expect(screen.getByLabelText('Lugar *')).toHaveValue('Salta');
  expect(screen.getByLabelText('Descripción')).toHaveValue('Finca sur');
  expect(screen.getByLabelText('Objetivo de árboles')).toHaveValue(null);

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(editarPlantacion)).toHaveBeenCalledWith(
    'plant-1',
    expect.objectContaining({ lugar: 'Salta', descripcion: 'Finca sur' }),
    { lugar: 'Salta', periodo: '2024-2025', descripcion: 'Finca sur' },
  );
  expect(vi.mocked(existePlantacion)).toHaveBeenCalledWith('Salta', '2024-2025', 'plant-1');
});

test('editar con conflicto: avisa, muestra el valor del server y lo usa como base nueva', async () => {
  const usuario = userEvent.setup();
  vi.mocked(editarPlantacion).mockRejectedValueOnce(
    new ConflictoDeEdicionError([{ campo: 'descripcion', valorServidor: 'Finca norte' }]),
  );
  const { onClose } = renderModal(SALTA);

  await usuario.clear(screen.getByLabelText('Descripción'));
  await usuario.type(screen.getByLabelText('Descripción'), 'Finca oeste');
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

  expect(await screen.findByText(MENSAJE_CONFLICTO_EDICION)).toBeInTheDocument();
  expect(screen.getByLabelText('Descripción')).toHaveValue('Finca norte');
  expect(onClose).not.toHaveBeenCalled();

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(vi.mocked(editarPlantacion)).toHaveBeenLastCalledWith(
    'plant-1',
    expect.objectContaining({ descripcion: 'Finca norte' }),
    expect.objectContaining({ descripcion: 'Finca norte' }),
  );
});

test('crear invalida el listado de plantaciones', async () => {
  const usuario = userEvent.setup();
  const { onClose, invalidateQueries } = renderModal();

  await completarObligatorios(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(invalidateQueries).toHaveBeenCalledTimes(1);
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantaciones'] });
});

test('editar invalida el listado y el detalle de esa plantación', async () => {
  const usuario = userEvent.setup();
  const { onClose, invalidateQueries } = renderModal(SALTA);

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(invalidateQueries).toHaveBeenCalledTimes(2);
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantaciones'] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantacion', 'plant-1'] });
});

test('error de red: muestra mensaje claro, conserva lo tipeado y no cierra', async () => {
  vi.mocked(crearPlantacion).mockRejectedValue(new Error('TypeError: Failed to fetch'));
  const usuario = userEvent.setup();
  const { onClose } = renderModal();

  await completarObligatorios(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo guardar la plantación. Revisá tu conexión y probá de nuevo.',
  );
  expect(screen.getByLabelText('Lugar *')).toHaveValue('Mendoza');
  expect(onClose).not.toHaveBeenCalled();
});

test('rechazo por RLS: dice que falta permiso, no que revise la conexión (#380)', async () => {
  vi.mocked(crearPlantacion).mockRejectedValue(
    Object.assign(new Error('new row violates row-level security policy'), { code: '42501' }),
  );
  const usuario = userEvent.setup();
  renderModal();

  await completarObligatorios(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No tenés permiso para guardar la plantación.',
  );
});

test('otro error del servidor: muestra el detalle que mandó (#380)', async () => {
  vi.mocked(crearPlantacion).mockRejectedValue(new Error('periodo inválido'));
  const usuario = userEvent.setup();
  renderModal();

  await completarObligatorios(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Crear' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo guardar la plantación: el servidor rechazó el cambio (periodo inválido).',
  );
});
