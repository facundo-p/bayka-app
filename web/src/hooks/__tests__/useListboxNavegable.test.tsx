import { act, renderHook } from '@testing-library/react';
import { mantenerVisible, useListboxNavegable } from '../useListboxNavegable';

function renderListbox(cantidad: number) {
  return renderHook(() => useListboxNavegable(cantidad, vi.fn())).result;
}

test('el buscador apunta a la lista y a la opción resaltada con los mismos ids', () => {
  const listbox = renderListbox(3).current;
  const buscador = listbox.propsBuscador();
  const lista = listbox.propsLista();

  expect(buscador).toMatchObject({
    role: 'combobox',
    'aria-expanded': true,
    'aria-autocomplete': 'list',
  });
  expect(lista.role).toBe('listbox');
  expect(buscador['aria-controls']).toBe(lista.id);
  expect(buscador['aria-activedescendant']).toBe(listbox.propsOpcion(0).id);
});

test('solo la opción resaltada queda aria-selected, y pasar el mouse la resalta', () => {
  const resultado = renderListbox(3);
  expect(resultado.current.propsOpcion(0)).toMatchObject({ role: 'option', 'aria-selected': true });
  expect(resultado.current.propsOpcion(1)['aria-selected']).toBe(false);

  act(() => resultado.current.propsOpcion(1).onMouseMove());

  expect(resultado.current.propsOpcion(1)['aria-selected']).toBe(true);
  expect(resultado.current.propsBuscador()['aria-activedescendant']).toBe(
    resultado.current.propsOpcion(1).id,
  );
});

test('sin opciones no hay opción activa', () => {
  expect(renderListbox(0).current.propsBuscador()['aria-activedescendant']).toBeUndefined();
});

const lista = (scrollTop: number, clientHeight: number) =>
  ({ scrollTop, clientHeight }) as HTMLElement;
const opcion = (offsetTop: number, offsetHeight: number) =>
  ({ offsetTop, offsetHeight }) as HTMLElement;

test('mantenerVisible sube el scroll si la opción quedó arriba y lo baja si quedó abajo', () => {
  const contenedor = lista(100, 200);
  mantenerVisible(contenedor, opcion(40, 30));
  expect(contenedor.scrollTop).toBe(40);

  mantenerVisible(contenedor, opcion(260, 30));
  expect(contenedor.scrollTop).toBe(90);
});

test('mantenerVisible no toca el scroll si la opción ya se ve', () => {
  const contenedor = lista(100, 200);
  mantenerVisible(contenedor, opcion(150, 30));
  expect(contenedor.scrollTop).toBe(100);
});
