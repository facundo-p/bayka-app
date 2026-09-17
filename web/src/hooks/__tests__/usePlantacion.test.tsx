import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { obtenerPlantacion } from '../../queries/plantationQueries';
import { usePlantacion } from '../usePlantacion';

vi.mock('../../queries/plantationQueries', () => ({ obtenerPlantacion: vi.fn() }));

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('pide la plantación por id', async () => {
  vi.mocked(obtenerPlantacion).mockResolvedValue(null);

  const { result } = renderHook(() => usePlantacion('plant-1'), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(vi.mocked(obtenerPlantacion)).toHaveBeenCalledWith('plant-1');
});

test('sin id queda pendiente y no consulta', () => {
  const { result } = renderHook(() => usePlantacion(''), { wrapper: wrapper() });

  expect(result.current.isPending).toBe(true);
  expect(result.current.fetchStatus).toBe('idle');
  expect(vi.mocked(obtenerPlantacion)).not.toHaveBeenCalled();
});
