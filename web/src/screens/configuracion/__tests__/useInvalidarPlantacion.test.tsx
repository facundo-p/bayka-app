import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvalidarPlantacion } from '../useInvalidarPlantacion';

function wrapperConCliente(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

test('invalida el detalle de la plantación y el listado general', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useInvalidarPlantacion('plant-1'), {
    wrapper: wrapperConCliente(queryClient),
  });

  await result.current();

  await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(2));
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantacion', 'plant-1'] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantaciones'] });
});
