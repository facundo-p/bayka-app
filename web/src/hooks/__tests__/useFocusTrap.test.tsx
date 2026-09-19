import type { RefObject } from 'react';
import { renderHook } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

/** Evento de teclado sintético mínimo, tipado como el que recibe el handler. */
function eventoTab(opciones: { shiftKey?: boolean } = {}) {
  return {
    key: 'Tab',
    shiftKey: opciones.shiftKey ?? false,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

function contenedorConBotones(html: string): RefObject<HTMLElement | null> {
  const contenedor = document.createElement('div');
  contenedor.innerHTML = html;
  document.body.appendChild(contenedor);
  return { current: contenedor };
}

afterEach(() => {
  document.body.innerHTML = '';
});

test('Tab en el último elemento vuelve el foco al primero', () => {
  const ref = contenedorConBotones('<button id="a">A</button><button id="b">B</button>');
  const { result } = renderHook(() => useFocusTrap(ref));
  const ultimo = ref.current!.querySelector<HTMLElement>('#b')!;
  ultimo.focus();

  const evento = eventoTab();
  result.current(evento);

  expect(evento.preventDefault).toHaveBeenCalled();
  expect(document.activeElement).toBe(ref.current!.querySelector('#a'));
});

test('Shift+Tab en el primer elemento manda el foco al último', () => {
  const ref = contenedorConBotones('<button id="a">A</button><button id="b">B</button>');
  const { result } = renderHook(() => useFocusTrap(ref));
  const primero = ref.current!.querySelector<HTMLElement>('#a')!;
  primero.focus();

  const evento = eventoTab({ shiftKey: true });
  result.current(evento);

  expect(evento.preventDefault).toHaveBeenCalled();
  expect(document.activeElement).toBe(ref.current!.querySelector('#b'));
});

test('Tab en un elemento intermedio no hace nada (deja que el navegador maneje el foco)', () => {
  const ref = contenedorConBotones(
    '<button id="a">A</button><button id="b">B</button><button id="c">C</button>',
  );
  const { result } = renderHook(() => useFocusTrap(ref));
  const intermedio = ref.current!.querySelector<HTMLElement>('#b')!;
  intermedio.focus();

  const evento = eventoTab();
  result.current(evento);

  expect(evento.preventDefault).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(intermedio);
});

test('ignora teclas distintas de Tab', () => {
  const ref = contenedorConBotones('<button id="a">A</button>');
  const { result } = renderHook(() => useFocusTrap(ref));
  const evento = {
    key: 'Enter',
    shiftKey: false,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;

  result.current(evento);
  expect(evento.preventDefault).not.toHaveBeenCalled();
});

test('sin ref.current (contenedor no montado) no lanza', () => {
  const ref: RefObject<HTMLElement | null> = { current: null };
  const { result } = renderHook(() => useFocusTrap(ref));
  expect(() => result.current(eventoTab())).not.toThrow();
});

test('contenedor sin elementos focuseables no lanza ni previene el default', () => {
  const ref = contenedorConBotones('<span>sin foco</span>');
  const { result } = renderHook(() => useFocusTrap(ref));
  const evento = eventoTab();
  expect(() => result.current(evento)).not.toThrow();
  expect(evento.preventDefault).not.toHaveBeenCalled();
});
