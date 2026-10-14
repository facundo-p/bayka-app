import { act, renderHook } from '@testing-library/react';
import { MS_CONFIRMACION_COPIADO, useCopiar } from '../useCopiar';

const writeText = vi.fn<(texto: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => vi.useRealTimers());

test('confirma al copiar y vuelve al ícono pasado el tiempo de confirmación', async () => {
  writeText.mockResolvedValue();
  const { result } = renderHook(() => useCopiar());

  await act(() => result.current.copiar('A-001-SS26'));

  expect(writeText).toHaveBeenCalledWith('A-001-SS26');
  expect(result.current.copiado).toBe(true);
  act(() => vi.advanceTimersByTime(MS_CONFIRMACION_COPIADO - 1));
  expect(result.current.copiado).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.copiado).toBe(false);
});

test('si el navegador niega el portapapeles no confirma', async () => {
  writeText.mockRejectedValue(new Error('sin permiso'));
  const { result } = renderHook(() => useCopiar());

  await act(() => result.current.copiar('A-001-SS26'));

  expect(result.current.copiado).toBe(false);
});
