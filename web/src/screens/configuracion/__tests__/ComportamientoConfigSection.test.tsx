import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComportamientoConfigSection } from '../ComportamientoConfigSection';
import {
  actualizarConfigGps,
  actualizarFotoEnTodos,
} from '../../../repositories/plantationRepository';
import { obtenerPlantacion, type Plantacion } from '../../../queries/plantationQueries';

vi.mock('../../../repositories/plantationRepository', async () => {
  const real = await vi.importActual<typeof import('../../../repositories/plantationRepository')>(
    '../../../repositories/plantationRepository',
  );
  return { ...real, actualizarConfigGps: vi.fn(), actualizarFotoEnTodos: vi.fn() };
});
vi.mock('../../../queries/plantationQueries', async () => {
  const real = await vi.importActual<typeof import('../../../queries/plantationQueries')>(
    '../../../queries/plantationQueries',
  );
  return { ...real, obtenerPlantacion: vi.fn() };
});

const PLANTACION: Plantacion = {
  id: 'plant-1',
  lugar: 'Sitio',
  periodo: '2025-2026',
  estado: 'activa',
  visibleInApp: true,
  gpsCaptureFrequency: 5,
  gpsCaptureRequired: true,
  photoCaptureAllTrees: false,
  createdAt: '2026-01-01T00:00:00Z',
  descripcion: null,
  fechaInicio: null,
  objetivoArboles: null,
};

function renderSeccion() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/plantaciones/plant-1']}>
        <Routes>
          <Route path="/plantaciones/:id" element={<ComportamientoConfigSection />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obtenerPlantacion).mockResolvedValue(PLANTACION);
  vi.mocked(actualizarConfigGps).mockResolvedValue(undefined);
  vi.mocked(actualizarFotoEnTodos).mockResolvedValue(undefined);
});

test('el toggle "Foto en todos los botones" guarda al cambiar y actualiza el hint', async () => {
  renderSeccion();
  const toggle = await screen.findByRole('switch', { name: 'Foto en todos los botones' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByText('Solo N/N pide foto')).toBeInTheDocument();

  fireEvent.click(toggle);

  await waitFor(() => expect(actualizarFotoEnTodos).toHaveBeenCalledWith('plant-1', true));
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(
    screen.getByText('Cada botón de especie pide foto antes de registrar, como N/N'),
  ).toBeInTheDocument();
});

test('si guardar la foto en todos falla, el toggle vuelve atrás y muestra el error', async () => {
  vi.mocked(actualizarFotoEnTodos).mockRejectedValue(new Error('sin permisos'));
  renderSeccion();
  const toggle = await screen.findByRole('switch', { name: 'Foto en todos los botones' });

  fireEvent.click(toggle);

  expect(
    await screen.findByText('No se pudo actualizar la foto en todos los botones.'),
  ).toBeInTheDocument();
  expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('escribir "10" y perder el foco guarda una sola vez con el valor final', async () => {
  renderSeccion();
  const input = await screen.findByLabelText('O un valor exacto: cada N árboles');

  fireEvent.change(input, { target: { value: '1' } });
  fireEvent.change(input, { target: { value: '10' } });
  expect(actualizarConfigGps).not.toHaveBeenCalled();

  fireEvent.blur(input);

  await waitFor(() => expect(actualizarConfigGps).toHaveBeenCalledTimes(1));
  expect(actualizarConfigGps).toHaveBeenCalledWith('plant-1', {
    frecuencia: 10,
    obligatoria: true,
  });
});

test('Enter confirma igual que el blur, sin duplicar el guardado', async () => {
  renderSeccion();
  const input = await screen.findByLabelText('O un valor exacto: cada N árboles');

  fireEvent.change(input, { target: { value: '7' } });
  fireEvent.keyDown(input, { key: 'Enter' });

  await waitFor(() => expect(actualizarConfigGps).toHaveBeenCalledTimes(1));
  expect(actualizarConfigGps).toHaveBeenCalledWith('plant-1', {
    frecuencia: 7,
    obligatoria: true,
  });

  fireEvent.blur(input);
  expect(actualizarConfigGps).toHaveBeenCalledTimes(1);
});

test('un valor inválido al perder el foco no persiste y el input vuelve al último valor válido', async () => {
  renderSeccion();
  const input = await screen.findByLabelText<HTMLInputElement>('O un valor exacto: cada N árboles');

  fireEvent.change(input, { target: { value: '0' } });
  fireEvent.blur(input);

  await waitFor(() => expect(input.value).toBe('5'));
  expect(actualizarConfigGps).not.toHaveBeenCalled();
});
