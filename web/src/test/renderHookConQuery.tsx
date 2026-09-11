import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

/** renderHook dentro de un QueryClient propio del test, sin reintentos. */
export function renderHookConQuery<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

/** El submit de un formulario, con preventDefault espiable. */
export function eventoEnvio() {
  return { preventDefault: vi.fn() } as unknown as FormEvent & { preventDefault: () => void };
}

/** Lo que tipea la persona en un input. */
export function eventoCambio(valor: string) {
  return { target: { value: valor } } as unknown as ChangeEvent<HTMLInputElement>;
}
