import { renderHook } from '@testing-library/react-native';
import { act } from 'react';
import { useWatchdogDeSync, MS_SIN_AVANCE } from '../../src/hooks/useWatchdogDeSync';

/** Ref de avance, como el que lleva `useSync`. */
const refDeAvance = (momento: number) => ({ current: momento });

describe('useWatchdogDeSync', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const avanzar = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  it('con la sync en curso y avance reciente, no marca estancamiento', () => {
    const { result } = renderHook(() => useWatchdogDeSync(true, refDeAvance(Date.now())));

    avanzar(MS_SIN_AVANCE - 1000);

    expect(result.current).toBe(false);
  });

  it('sin ninguna señal de avance durante el umbral, se ofrece cancelar', () => {
    const { result } = renderHook(() => useWatchdogDeSync(true, refDeAvance(Date.now())));

    avanzar(MS_SIN_AVANCE);

    expect(result.current).toBe(true);
  });

  // Lo que se cronometra es el estancamiento, no la duración: una sync lenta que
  // sigue avanzando no se ofrece cancelar.
  it('una sync lenta pero que avanza nunca se marca como estancada', () => {
    const avance = refDeAvance(Date.now());
    const { result } = renderHook(() => useWatchdogDeSync(true, avance));

    for (let i = 0; i < 10; i++) {
      avanzar(MS_SIN_AVANCE - 1000);
      avance.current = Date.now();
    }

    expect(result.current).toBe(false);
  });

  it('un avance después del estancamiento vuelve a apagarlo', () => {
    const avance = refDeAvance(Date.now());
    const { result } = renderHook(() => useWatchdogDeSync(true, avance));
    avanzar(MS_SIN_AVANCE);
    expect(result.current).toBe(true);

    avance.current = Date.now();
    avanzar(1000);

    expect(result.current).toBe(false);
  });

  it('con la sync terminada no cronometra nada', () => {
    const { result } = renderHook(() => useWatchdogDeSync(false, refDeAvance(0)));

    avanzar(MS_SIN_AVANCE * 2);

    expect(result.current).toBe(false);
  });

  it('al terminar la sync deja de correr el reloj', () => {
    const { rerender } = renderHook(
      ({ activo }) => useWatchdogDeSync(activo, refDeAvance(Date.now())),
      { initialProps: { activo: true } },
    );

    rerender({ activo: false });

    expect(jest.getTimerCount()).toBe(0);
  });
});
