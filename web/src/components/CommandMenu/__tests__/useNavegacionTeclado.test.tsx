import { act, renderHook } from '@testing-library/react';
import { useNavegacionTeclado } from '../useNavegacionTeclado';

function evento(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
}

test('arranca resaltando el primer ítem', () => {
  const { result } = renderHook(() => useNavegacionTeclado(3, vi.fn()));
  expect(result.current.resaltado).toBe(0);
});

test('ArrowDown avanza y da la vuelta al llegar al final', () => {
  const { result } = renderHook(() => useNavegacionTeclado(3, vi.fn()));
  act(() => result.current.alPresionar(evento('ArrowDown')));
  expect(result.current.resaltado).toBe(1);
  act(() => result.current.alPresionar(evento('ArrowDown')));
  expect(result.current.resaltado).toBe(2);
  act(() => result.current.alPresionar(evento('ArrowDown')));
  expect(result.current.resaltado).toBe(0);
});

test('ArrowUp retrocede y da la vuelta al llegar al principio', () => {
  const { result } = renderHook(() => useNavegacionTeclado(3, vi.fn()));
  act(() => result.current.alPresionar(evento('ArrowUp')));
  expect(result.current.resaltado).toBe(2);
  act(() => result.current.alPresionar(evento('ArrowUp')));
  expect(result.current.resaltado).toBe(1);
});

test('Enter elige el índice resaltado actual', () => {
  const alElegir = vi.fn();
  const { result } = renderHook(() => useNavegacionTeclado(3, alElegir));
  act(() => result.current.alPresionar(evento('ArrowDown')));
  act(() => result.current.alPresionar(evento('Enter')));
  expect(alElegir).toHaveBeenCalledWith(1);
});

test('con cantidad 0 no cambia el resaltado ni llama a alElegir', () => {
  const alElegir = vi.fn();
  const { result } = renderHook(() => useNavegacionTeclado(0, alElegir));
  act(() => result.current.alPresionar(evento('ArrowDown')));
  act(() => result.current.alPresionar(evento('Enter')));
  expect(result.current.resaltado).toBe(0);
  expect(alElegir).not.toHaveBeenCalled();
});

test('ignora teclas que no son de navegación', () => {
  const alElegir = vi.fn();
  const { result } = renderHook(() => useNavegacionTeclado(3, alElegir));
  const ev = evento('a');
  act(() => result.current.alPresionar(ev));
  expect(result.current.resaltado).toBe(0);
  expect(ev.preventDefault).not.toHaveBeenCalled();
  expect(alElegir).not.toHaveBeenCalled();
});

test('al cambiar la cantidad de ítems, vuelve a resaltar el primero', () => {
  const { result, rerender } = renderHook(({ cantidad }) => useNavegacionTeclado(cantidad, vi.fn()), {
    initialProps: { cantidad: 3 },
  });
  act(() => result.current.alPresionar(evento('ArrowDown')));
  expect(result.current.resaltado).toBe(1);
  rerender({ cantidad: 5 });
  expect(result.current.resaltado).toBe(0);
});

test('expone la ref del contenedor de la lista', () => {
  const { result } = renderHook(() => useNavegacionTeclado(3, vi.fn()));
  expect(result.current.refLista.current).toBeNull();
});
