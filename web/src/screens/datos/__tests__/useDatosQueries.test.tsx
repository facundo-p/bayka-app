import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { listarGrupos, listarParcelasConStats } from '../../../queries/dataExplorerQueries';
import { useGruposDatos, useParcelasDatos } from '../useDatosQueries';

vi.mock('../../../queries/dataExplorerQueries', () => ({
  listarParcelasConStats: vi.fn(),
  listarGrupos: vi.fn(),
}));

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('useParcelasDatos llama a listarParcelasConStats con la plantación', async () => {
  vi.mocked(listarParcelasConStats).mockResolvedValue([]);

  const { result } = renderHook(() => useParcelasDatos('plant-1'), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(vi.mocked(listarParcelasConStats)).toHaveBeenCalledWith('plant-1');
});

test('useGruposDatos sin parcela llama a listarGrupos con {} (no parcelaId vacío)', async () => {
  vi.mocked(listarGrupos).mockResolvedValue([]);

  const { result } = renderHook(() => useGruposDatos('plant-1', ''), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(vi.mocked(listarGrupos)).toHaveBeenCalledWith('plant-1', {});
});

test('useGruposDatos con parcela llama a listarGrupos con { parcelaId }', async () => {
  vi.mocked(listarGrupos).mockResolvedValue([]);

  const { result } = renderHook(() => useGruposDatos('plant-1', 'p1'), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(vi.mocked(listarGrupos)).toHaveBeenCalledWith('plant-1', { parcelaId: 'p1' });
});

test('useGruposDatos usa distinta query key por parcela (invalidan/refetchean por separado)', async () => {
  vi.mocked(listarGrupos).mockResolvedValue([]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const clientWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result, rerender } = renderHook(
    ({ parcelaId }: { parcelaId: string }) => useGruposDatos('plant-1', parcelaId),
    { wrapper: clientWrapper, initialProps: { parcelaId: '' } },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  rerender({ parcelaId: 'p1' });
  await waitFor(() => expect(vi.mocked(listarGrupos)).toHaveBeenCalledTimes(2));

  expect(vi.mocked(listarGrupos)).toHaveBeenNthCalledWith(1, 'plant-1', {});
  expect(vi.mocked(listarGrupos)).toHaveBeenNthCalledWith(2, 'plant-1', { parcelaId: 'p1' });
});
