import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { useInvalidarConListado } from '../useInvalidarConListado';

function renderConEspia(clave?: readonly unknown[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useInvalidarConListado(clave), { wrapper });
  return { invalidar: result.current, invalidateQueries };
}

test('invalida la clave y el listado de plantaciones', async () => {
  const { invalidar, invalidateQueries } = renderConEspia(CLAVE_QUERY.plantacion('plant-1'));

  await invalidar();

  expect(invalidateQueries).toHaveBeenCalledTimes(2);
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantacion', 'plant-1'] });
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantaciones'] });
});

test('sin clave invalida solo el listado', async () => {
  const { invalidar, invalidateQueries } = renderConEspia();

  await invalidar();

  expect(invalidateQueries).toHaveBeenCalledTimes(1);
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plantaciones'] });
});
