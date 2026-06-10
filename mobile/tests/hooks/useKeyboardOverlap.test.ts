// Tests for useKeyboardOverlap hook
// Valida que la cobertura del teclado se calcule como alto_de_ventana − screenY
// (geometría real, exacta por dispositivo) y NO con endCoordinates.height, que
// en edge-to-edge sub-reporta por el inset de la nav bar.

import { renderHook, act } from '@testing-library/react-native';
import { Keyboard, Dimensions } from 'react-native';
import { useKeyboardOverlap } from '../../src/hooks/useKeyboardOverlap';

describe('useKeyboardOverlap', () => {
  const listeners: Record<string, (e?: any) => void> = {};
  let addSpy: jest.SpyInstance;
  let dimSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const key of Object.keys(listeners)) delete listeners[key];
    addSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event: string, cb: (e?: any) => void) => {
        listeners[event] = cb;
        return { remove: jest.fn() } as any;
      });
    // Device de referencia medido: ventana 823dp, teclado arriba en 465dp.
    dimSpy = jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ height: 823, width: 411, scale: 2.8125, fontScale: 1 } as any);
  });

  afterEach(() => {
    addSpy.mockRestore();
    dimSpy.mockRestore();
  });

  it('arranca en 0 con el teclado cerrado', () => {
    const { result } = renderHook(() => useKeyboardOverlap());
    expect(result.current).toBe(0);
  });

  it('cobertura = alto_de_ventana − screenY (no el height sub-reportado)', () => {
    const { result } = renderHook(() => useKeyboardOverlap());
    act(() => {
      // height=310 está sub-reportado; lo correcto es 823 − 465 = 358.
      listeners['keyboardDidShow']({ endCoordinates: { screenY: 465, height: 310 } });
    });
    expect(result.current).toBe(358);
  });

  it('vuelve a 0 al cerrar (sin franja residual)', () => {
    const { result } = renderHook(() => useKeyboardOverlap());
    act(() => listeners['keyboardDidShow']({ endCoordinates: { screenY: 465, height: 310 } }));
    act(() => listeners['keyboardDidHide']());
    expect(result.current).toBe(0);
  });

  it('clampa a 0 si el borde del teclado cae bajo el borde inferior (defensivo)', () => {
    const { result } = renderHook(() => useKeyboardOverlap());
    act(() => listeners['keyboardDidShow']({ endCoordinates: { screenY: 900, height: 0 } }));
    expect(result.current).toBe(0);
  });

  it('se adapta a otro dispositivo: ventana y teclado distintos, sin constantes', () => {
    dimSpy.mockReturnValue({ height: 640, width: 360, scale: 2, fontScale: 1 } as any);
    const { result } = renderHook(() => useKeyboardOverlap());
    act(() => listeners['keyboardDidShow']({ endCoordinates: { screenY: 400, height: 200 } }));
    expect(result.current).toBe(240); // 640 − 400, recalculado para ese device
  });

  it('limpia los listeners al desmontar', () => {
    const remove = jest.fn();
    addSpy.mockImplementation((event: string, cb: (e?: any) => void) => {
      listeners[event] = cb;
      return { remove } as any;
    });
    const { unmount } = renderHook(() => useKeyboardOverlap());
    unmount();
    expect(remove).toHaveBeenCalledTimes(2); // show + hide
  });
});
