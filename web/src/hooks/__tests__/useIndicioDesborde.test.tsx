import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { medirDesborde, useIndicioDesborde } from '../useIndicioDesborde';

/** jsdom no hace layout: las medidas del elemento se fijan a mano. */
function elementoConScroll(scrollWidth: number, clientWidth: number, scrollLeft = 0) {
  const el = document.createElement('div');
  Object.defineProperties(el, {
    scrollWidth: { value: scrollWidth, configurable: true },
    clientWidth: { value: clientWidth, configurable: true },
    scrollLeft: { value: scrollLeft, writable: true, configurable: true },
  });
  return el;
}

describe('medirDesborde', () => {
  test('sin overflow no hay indicio a ningún lado', () => {
    expect(medirDesborde(elementoConScroll(300, 300))).toEqual({
      izquierda: false,
      derecha: false,
    });
  });

  test('con overflow y sin scrollear, solo queda contenido a la derecha', () => {
    expect(medirDesborde(elementoConScroll(800, 300))).toEqual({
      izquierda: false,
      derecha: true,
    });
  });

  test('al final del scroll, solo queda contenido a la izquierda (tolera 1px de redondeo)', () => {
    expect(medirDesborde(elementoConScroll(800, 300, 499))).toEqual({
      izquierda: true,
      derecha: false,
    });
  });

  test('en el medio hay contenido a los dos lados', () => {
    expect(medirDesborde(elementoConScroll(800, 300, 200))).toEqual({
      izquierda: true,
      derecha: true,
    });
  });
});

test('el hook mide al montar y sigue el scroll del elemento', () => {
  const el = elementoConScroll(800, 300);
  const ref = createRef<HTMLElement>();
  Object.assign(ref, { current: el });

  const { result } = renderHook(() => useIndicioDesborde(ref));
  expect(result.current).toEqual({ izquierda: false, derecha: true });

  act(() => {
    el.scrollLeft = 500;
    el.dispatchEvent(new Event('scroll'));
  });
  expect(result.current).toEqual({ izquierda: true, derecha: false });
});

test('sin elemento no hay indicio', () => {
  const ref = createRef<HTMLElement>();
  const { result } = renderHook(() => useIndicioDesborde(ref));
  expect(result.current).toEqual({ izquierda: false, derecha: false });
});
