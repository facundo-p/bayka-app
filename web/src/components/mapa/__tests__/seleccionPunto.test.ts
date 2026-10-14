import { act, renderHook } from '@testing-library/react';
import { reducirSeleccion, seleccionVigente, useSeleccionPunto } from '../seleccionPunto';
import type { PuntoGps } from '../types';

function punto(idArbol: string): PuntoGps {
  return { lat: 0, lng: 0, codigo: 'QB', nombre: '', idArbol, subId: idArbol, parcelaId: null };
}

const A = punto('A');
const B = punto('B');

describe('reducirSeleccion', () => {
  test('abrir elige el punto con su id', () => {
    expect(reducirSeleccion(null, { tipo: 'abrir', punto: A, id: 1 })).toEqual({ punto: A, id: 1 });
  });

  test('cerrar la selección vigente la suelta; cerrar una vieja no la toca', () => {
    const actual = { punto: B, id: 2 };

    expect(reducirSeleccion(actual, { tipo: 'cerrar', id: 2 })).toBeNull();
    expect(reducirSeleccion(actual, { tipo: 'cerrar', id: 1 })).toBe(actual);
  });

  test('cerrar y reabrir el mismo punto en el mismo tick deja un estado nuevo', () => {
    const abierta = { punto: A, id: 1 };

    const cerrada = reducirSeleccion(abierta, { tipo: 'cerrar', id: 1 });
    const reabierta = reducirSeleccion(cerrada, { tipo: 'abrir', punto: A, id: 2 });

    expect(reabierta).toEqual({ punto: A, id: 2 });
    expect(reabierta).not.toBe(abierta);
  });
});

describe('seleccionVigente', () => {
  test('vale mientras el punto siga en el mapa', () => {
    const seleccion = { punto: A, id: 1 };

    expect(seleccionVigente(seleccion, [A, B])).toBe(seleccion);
    expect(seleccionVigente(seleccion, [B])).toBeNull();
    expect(seleccionVigente(null, [A])).toBeNull();
  });
});

describe('useSeleccionPunto', () => {
  function montar(puntos: PuntoGps[]) {
    return renderHook(({ visibles }) => useSeleccionPunto(visibles), {
      initialProps: { visibles: puntos },
    });
  }

  test('abrir un punto lo selecciona', () => {
    const { result } = montar([A, B]);

    act(() => result.current.seleccionar(A));

    expect(result.current.seleccion?.punto).toBe(A);
  });

  test('pasar de un punto a otro: cerrar el popup anterior no pisa al nuevo', () => {
    const { result } = montar([A, B]);
    act(() => result.current.seleccionar(A));
    const idDeA = result.current.seleccion!.id;

    act(() => {
      result.current.cerrar(idDeA);
      result.current.seleccionar(B);
    });
    act(() => result.current.cerrar(idDeA));

    expect(result.current.seleccion?.punto).toBe(B);
  });

  test('clickear el punto del popup abierto lo reabre con otro id', () => {
    const { result } = montar([A]);
    act(() => result.current.seleccionar(A));
    const primera = result.current.seleccion!;

    // Leaflet cierra el popup en `preclick` y el `click` del punto lo vuelve a pedir.
    act(() => {
      result.current.cerrar(primera.id);
      result.current.seleccionar(A);
    });

    expect(result.current.seleccion?.punto).toBe(A);
    expect(result.current.seleccion?.id).not.toBe(primera.id);
  });

  test('cerrar con la X suelta el punto y se puede volver a abrir', () => {
    const { result } = montar([A]);
    act(() => result.current.seleccionar(A));

    act(() => result.current.cerrar(result.current.seleccion!.id));
    expect(result.current.seleccion).toBeNull();

    act(() => result.current.seleccionar(A));
    expect(result.current.seleccion?.punto).toBe(A);
  });

  test('si el filtro deja afuera al punto se cierra, y no reaparece al volver', () => {
    const { result, rerender } = montar([A, B]);
    act(() => result.current.seleccionar(A));

    rerender({ visibles: [B] });
    expect(result.current.seleccion).toBeNull();

    rerender({ visibles: [A, B] });
    expect(result.current.seleccion).toBeNull();
  });
});
