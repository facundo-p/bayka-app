import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useFiltrosDatos } from '../useFiltrosDatos';

function wrapperConUrl(url: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
}

test('lee los filtros iniciales desde la URL', () => {
  const { result } = renderHook(() => useFiltrosDatos(), {
    wrapper: wrapperConUrl('/datos/arboles?parcela=p1&grupo=g1'),
  });
  expect(result.current.filtros.parcelaId).toBe('p1');
  expect(result.current.filtros.groupId).toBe('g1');
  expect(result.current.filtrosActivos).toBe(2);
});

test('cambiar de parcela resetea el grupo en scope', () => {
  const { result } = renderHook(() => useFiltrosDatos(), {
    wrapper: wrapperConUrl('/datos/arboles?parcela=p1&grupo=g1'),
  });
  act(() => result.current.setFiltro('parcelaId', 'p2'));
  expect(result.current.filtros.parcelaId).toBe('p2');
  expect(result.current.filtros.groupId).toBe('');
});

test('la búsqueda no cuenta en los filtros activos', () => {
  const { result } = renderHook(() => useFiltrosDatos(), {
    wrapper: wrapperConUrl('/datos/arboles?parcela=p1&q=A-12'),
  });
  expect(result.current.filtrosActivos).toBe(1);
  expect(result.current.hayFiltroOBusqueda).toBe(true);
});

test('limpiar borra los filtros del panel y deja la búsqueda', () => {
  const { result } = renderHook(() => useFiltrosDatos(), {
    wrapper: wrapperConUrl('/datos/arboles?parcela=p1&grupo=g1&foto=con&q=A-12'),
  });
  act(() => result.current.limpiar());
  expect(result.current.filtrosActivos).toBe(0);
  expect(result.current.filtros.parcelaId).toBe('');
  expect(result.current.filtros.busqueda).toBe('A-12');
});

test('limpiarTodo, el de la tabla vacía, también borra la búsqueda', () => {
  const { result } = renderHook(() => useFiltrosDatos(), {
    wrapper: wrapperConUrl('/datos/arboles?parcela=p1&q=A-12'),
  });
  act(() => result.current.limpiarTodo());
  expect(result.current.hayFiltroOBusqueda).toBe(false);
  expect(result.current.filtros.busqueda).toBe('');
});
