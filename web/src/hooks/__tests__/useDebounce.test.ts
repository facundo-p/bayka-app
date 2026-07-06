import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { useDebounce } from '../useDebounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('devuelve el valor inicial de inmediato', () => {
  const { result } = renderHook(() => useDebounce('a', 300));
  expect(result.current).toBe('a');
});

test('demora la actualización hasta que pasa el retardo', () => {
  const { result, rerender } = renderHook(({ valor }) => useDebounce(valor, 300), {
    initialProps: { valor: 'a' },
  });
  rerender({ valor: 'ab' });
  expect(result.current).toBe('a');
  act(() => vi.advanceTimersByTime(300));
  expect(result.current).toBe('ab');
});

test('cambios rápidos sucesivos solo emiten el último valor', () => {
  const { result, rerender } = renderHook(({ valor }) => useDebounce(valor, 300), {
    initialProps: { valor: 'a' },
  });
  rerender({ valor: 'ab' });
  act(() => vi.advanceTimersByTime(100));
  rerender({ valor: 'abc' });
  act(() => vi.advanceTimersByTime(100));
  expect(result.current).toBe('a');
  act(() => vi.advanceTimersByTime(300));
  expect(result.current).toBe('abc');
});
