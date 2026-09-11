import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { DEMORA_BUSQUEDA_MS, useBusquedaDemorada } from '../useBusquedaDemorada';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('arranca vacía', () => {
  const { result } = renderHook(() => useBusquedaDemorada());
  expect(result.current.busqueda).toBe('');
  expect(result.current.busquedaDemorada).toBe('');
});

test('el input sigue al tipeo y el filtro llega recién después de la demora', () => {
  const { result } = renderHook(() => useBusquedaDemorada());

  act(() => result.current.setBusqueda('anch'));
  expect(result.current.busqueda).toBe('anch');
  expect(result.current.busquedaDemorada).toBe('');

  act(() => vi.advanceTimersByTime(DEMORA_BUSQUEDA_MS));
  expect(result.current.busquedaDemorada).toBe('anch');
});
